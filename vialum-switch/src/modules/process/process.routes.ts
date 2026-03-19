// ════════════════════════════════════════════════════════════
// Process Routes — Main Switch endpoint
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProcessor, getAllProcessors } from '../../processors/processor.interface.js';
import * as mediaClient from '../../lib/media-client.js';
import { getPrisma } from '../../config/database.js';

export async function processRoutes(fastify: FastifyInstance) {

  // POST /process — Main processing endpoint
  fastify.post('/process', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.processor) {
      return reply.status(400).send({ error: 'processor is required', code: 'MISSING_FIELD' });
    }

    const processorName = body.processor as string;
    const processor = getProcessor(processorName);
    if (!processor) {
      return reply.status(400).send({
        error: `Unknown processor: ${processorName}`,
        available: getAllProcessors().map(p => p.name),
        code: 'UNKNOWN_PROCESSOR',
      });
    }

    const input = body.input as Record<string, unknown> | undefined ?? {};
    const params = body.params as Record<string, unknown> | undefined;
    const fileId = input.fileId as string | undefined;
    const fileUrl = input.fileUrl as string | undefined;

    if (!fileId && !fileUrl && !input.text) {
      return reply.status(400).send({ error: 'input.fileId, input.fileUrl, or input.text is required', code: 'MISSING_INPUT' });
    }

    try {
      // Resolve file content
      let buffer: Buffer;
      let mimeType: string;
      let presignedUrl: string | undefined;

      if (fileId) {
        const downloaded = await mediaClient.downloadFile(accountId, fileId);
        buffer = downloaded.buffer;
        mimeType = downloaded.mimeType;
        presignedUrl = await mediaClient.getPresignedUrl(accountId, fileId);
      } else if (fileUrl) {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to download: ${res.status}`);
        buffer = Buffer.from(await res.arrayBuffer());
        mimeType = input.mimeType as string ?? res.headers.get('content-type') ?? 'application/octet-stream';
        presignedUrl = fileUrl;
      } else {
        // Text input
        buffer = Buffer.from(input.text as string, 'utf-8');
        mimeType = 'text/plain';
      }

      // Check mime type support
      const supported = processor.supportedMimeTypes.some(s =>
        s === mimeType || (s.endsWith('/*') && mimeType.startsWith(s.replace('/*', '/'))),
      );
      if (!supported) {
        return reply.status(400).send({
          error: `Processor "${processorName}" does not support mime type: ${mimeType}`,
          supportedMimeTypes: processor.supportedMimeTypes,
          code: 'UNSUPPORTED_MIME',
        });
      }

      // Process (pass accountId for DB config loading)
      const result = await processor.process({ buffer, mimeType, fileUrl: presignedUrl, params, accountId });

      // Save job to DB
      const prisma = getPrisma();
      const job = await prisma.switchJob.create({
        data: {
          accountId,
          processor: processorName,
          provider: result.provider,
          status: result.confidence !== undefined && result.confidence > 0 ? 'completed' : 'failed',
          inputType: fileId ? 'file' : fileUrl ? 'url' : 'text',
          inputRef: fileId ?? fileUrl ?? null,
          inputMime: mimeType,
          params: (params ?? {}) as any,
          result: result.result as any,
          confidence: result.confidence ?? null,
          processingMs: result.processingMs,
        },
      });

      // Update Media Service classification if applicable
      if (fileId && processorName === 'classify' && result.result && (result.confidence ?? 0) > 0.5) {
        mediaClient.updateClassification(accountId, fileId, result.result).catch(() => {});
      }

      return reply.send({
        id: job.id,
        processor: result.processor,
        provider: result.provider,
        result: result.result,
        confidence: result.confidence,
        processingMs: result.processingMs,
      });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      request.log.error(err);
      return reply.status(500).send({ error: 'Processing failed', details: String(err) });
    }
  });

  // GET /processors — List available processors
  fastify.get('/processors', async (_request: FastifyRequest, reply: FastifyReply) => {
    const processors = getAllProcessors().map(p => ({
      name: p.name,
      supportedMimeTypes: p.supportedMimeTypes,
    }));
    return reply.send({ data: processors });
  });

  // GET /jobs/:jobId — Get job result
  fastify.get('/jobs/:jobId', async (request: FastifyRequest<{ Params: { jobId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const job = await prisma.switchJob.findFirst({
      where: { id: request.params.jobId, accountId },
    });
    if (!job) return reply.status(404).send({ error: 'Job not found', code: 'NOT_FOUND' });
    return reply.send({ data: job });
  });
}
