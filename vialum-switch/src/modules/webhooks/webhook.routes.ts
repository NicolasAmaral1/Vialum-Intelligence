// ════════════════════════════════════════════════════════════
// Webhook Routes — Generic receiver + emitter
// Any source can send events, Switch auto-processes based on DB rules
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProcessor } from '../../processors/processor.interface.js';
import { loadAutoRules, loadWebhookConfigs } from '../../lib/config-loader.js';
import * as mediaClient from '../../lib/media-client.js';
import { getPrisma } from '../../config/database.js';
import { env } from '../../config/env.js';

interface WebhookPayload {
  source?: string;
  event: string;
  accountId: string;
  data: {
    id: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    contextType?: string;
    contextId?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  timestamp?: string;
}

export async function webhookRoutes(fastify: FastifyInstance) {

  // POST /webhooks — Generic webhook receiver
  fastify.post('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as WebhookPayload;

    // Verify secret
    const secret = request.headers['x-webhook-secret'] as string | undefined;
    if (env.WEBHOOK_SECRET && secret !== env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Invalid webhook secret' });
    }

    const source = body.source ?? 'unknown';
    const { event, accountId, data } = body;

    if (!accountId || !event || !data?.id) {
      return reply.status(400).send({ error: 'accountId, event, and data.id are required' });
    }

    // Load auto-rules from DB for this tenant
    const mimeType = data.mimeType ?? 'application/octet-stream';
    const rules = await loadAutoRules(accountId, source, event, mimeType);

    if (rules.length === 0) {
      return reply.send({ status: 'no_rules', reason: `No auto-rules match: source=${source}, event=${event}, mime=${mimeType}` });
    }

    // Collect all processors from matching rules
    const allProcessors: Array<{ processor: string; params?: Record<string, unknown> }> = [];
    for (const rule of rules) {
      const procs = rule.processors as Array<{ processor: string; params?: Record<string, unknown> }>;
      allProcessors.push(...procs);
    }

    request.log.info(`Auto-processing ${data.id} (${mimeType}): ${allProcessors.map(p => p.processor).join(', ')}`);

    // Respond immediately
    reply.send({ status: 'accepted', fileId: data.id, processors: allProcessors.map(p => p.processor) });

    // Process in background
    processInBackground(accountId, data.id, mimeType, allProcessors).catch((err) => {
      fastify.log.error({ err, fileId: data.id }, 'Background processing failed');
    });
  });
}

async function processInBackground(
  accountId: string,
  fileId: string,
  mimeType: string,
  processors: Array<{ processor: string; params?: Record<string, unknown> }>,
) {
  const prisma = getPrisma();

  // Download file once
  let buffer: Buffer;
  let fileUrl: string;
  try {
    const downloaded = await mediaClient.downloadFile(accountId, fileId);
    buffer = downloaded.buffer;
    fileUrl = await mediaClient.getPresignedUrl(accountId, fileId);
  } catch (err) {
    console.error(`Failed to download file ${fileId}:`, err);
    return;
  }

  for (const { processor: processorName, params } of processors) {
    const processor = getProcessor(processorName);
    if (!processor) continue;

    // Check mime support
    const supported = processor.supportedMimeTypes.some(s =>
      s === mimeType || (s.endsWith('/*') && mimeType.startsWith(s.replace('/*', '/'))),
    );
    if (!supported) continue;

    try {
      const result = await processor.process({ buffer, mimeType, fileUrl, params, accountId });

      // Save job
      const job = await prisma.switchJob.create({
        data: {
          accountId,
          processor: processorName,
          provider: result.provider,
          status: (result.confidence ?? 0) > 0 ? 'completed' : 'failed',
          inputType: 'file',
          inputRef: fileId,
          inputMime: mimeType,
          params: (params ?? {}) as any,
          result: result.result as any,
          confidence: result.confidence ?? null,
          processingMs: result.processingMs,
        },
      });

      // Update Media Service classification
      if (processorName === 'classify' && (result.confidence ?? 0) > 0.5) {
        await mediaClient.updateClassification(accountId, fileId, result.result).catch(() => {});
      }

      // Emit webhook: job.completed (Etapa 7)
      await emitJobCompleted(accountId, {
        jobId: job.id,
        processor: processorName,
        provider: result.provider,
        result: result.result,
        confidence: result.confidence,
        input: { fileId, mimeType },
      });

      console.log(`[auto] ${processorName} on ${fileId}: ${JSON.stringify(result.result).substring(0, 100)} (${result.processingMs}ms)`);
    } catch (err) {
      console.error(`[auto] ${processorName} failed on ${fileId}:`, err);
    }
  }
}

// ── Webhook emitter (Etapa 7) ─────────────────────────────

async function emitJobCompleted(accountId: string, data: Record<string, unknown>) {
  const configs = await loadWebhookConfigs(accountId, 'job.completed');

  for (const config of configs) {
    fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}),
      },
      body: JSON.stringify({
        event: 'job.completed',
        accountId,
        data,
        timestamp: new Date().toISOString(),
      }),
    }).catch((err) => {
      console.error(`Webhook emit failed to ${config.url}:`, err);
    });
  }
}
