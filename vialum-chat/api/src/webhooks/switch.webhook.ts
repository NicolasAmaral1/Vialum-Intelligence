import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { getEnv } from '../config/env.js';

// ════════════════════════════════════════════════════════════
// Switch Webhook — receives job.completed from Vialum Switch
// and updates message.textContent with extracted text.
//
// Payload from Switch:
// {
//   event: 'job.completed',
//   data: {
//     jobId: string,
//     fileId: string,
//     processor: 'ocr' | 'transcribe' | 'classify' | 'extract',
//     status: 'completed' | 'failed',
//     result: { text?: string, ... },
//     accountId: string,
//   }
// }
// ════════════════════════════════════════════════════════════

interface SwitchWebhookPayload {
  event: string;
  data: {
    jobId: string;
    fileId: string;
    processor: string;
    status: string;
    result: Record<string, unknown>;
    accountId?: string;
  };
}

const TEXT_PREFIXES: Record<string, string> = {
  transcribe: '[Áudio]',
  ocr: '[Documento]',
  classify: '[Classificação]',
  extract: '[Extração]',
};

export async function switchWebhookRoutes(fastify: FastifyInstance) {

  fastify.post('/switch', async (request: FastifyRequest, reply: FastifyReply) => {
    const env = getEnv();

    // Validate webhook secret if configured
    if (env.SWITCH_WEBHOOK_SECRET) {
      const secret = request.headers['x-webhook-secret'] as string | undefined;
      if (secret !== env.SWITCH_WEBHOOK_SECRET) {
        return reply.status(401).send({ error: 'Invalid webhook secret' });
      }
    }

    const payload = request.body as SwitchWebhookPayload;

    if (payload.event !== 'job.completed') {
      return reply.status(200).send({ status: 'ignored', reason: 'not job.completed' });
    }

    const { fileId, processor, status, result } = payload.data;

    if (status !== 'completed' || !result) {
      return reply.status(200).send({ status: 'ignored', reason: 'job not completed or no result' });
    }

    const extractedText = (result.text as string) ?? (result.content as string) ?? null;
    if (!extractedText) {
      return reply.status(200).send({ status: 'ignored', reason: 'no text in result' });
    }

    // Find message by fileId — first try Redis cache, then Prisma JSON query
    const redis = getRedis();
    const prisma = getPrisma();

    let messageId: string | null = null;
    let conversationId: string | null = null;
    let contentType: string | null = null;

    const cached = await redis.get(`media:file:${fileId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      messageId = parsed.messageId;
      conversationId = parsed.conversationId;
      contentType = parsed.contentType;
    } else {
      // Fallback: query by contentAttributes JSON
      const message = await prisma.message.findFirst({
        where: {
          contentAttributes: { path: ['mediaFileId'], equals: fileId },
        },
        select: { id: true, conversationId: true, contentType: true },
      });

      if (message) {
        messageId = message.id;
        conversationId = message.conversationId;
        contentType = message.contentType;
      }
    }

    if (!messageId) {
      fastify.log.warn(`[switch:webhook] No message found for fileId ${fileId}`);
      return reply.status(200).send({ status: 'ignored', reason: 'message not found' });
    }

    // Build textContent with prefix
    const prefix = TEXT_PREFIXES[processor] ?? `[${processor}]`;
    const textContent = `${prefix} ${extractedText}`;

    // Update message — idempotent (skip if already set)
    const existing = await prisma.message.findUnique({
      where: { id: messageId },
      select: { textContent: true },
    });

    if (existing?.textContent) {
      return reply.status(200).send({ status: 'skipped', reason: 'textContent already set' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { textContent },
    });

    // Emit WebSocket event for real-time UI update
    if (conversationId) {
      fastify.io.to(`conversation:${conversationId}`).emit('message:updated', {
        messageId,
        conversationId,
        textContent,
      });
    }

    fastify.log.info(`[switch:webhook] textContent updated for message ${messageId} (${processor})`);
    return reply.status(200).send({ status: 'processed', messageId });
  });
}
