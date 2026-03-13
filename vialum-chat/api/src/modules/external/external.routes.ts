import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as externalService from './external.service.js';

export async function externalRoutes(fastify: FastifyInstance) {
  // Apply API key auth to all routes in this scope
  fastify.addHook('onRequest', (fastify as any).authenticateApiKey);

  // POST /chat/api/v1/external/messages
  fastify.post('/messages', async (
    request: FastifyRequest<{
      Body: {
        phone: string;
        inboxId: string;
        content: string;
        mode?: 'hitl' | 'direct';
        senderLabel?: string;
        blockDelay?: number;
        metadata?: Record<string, unknown>;
      };
    }>,
    reply: FastifyReply,
  ) => {
    const body = request.body as Record<string, unknown>;

    // Validate required fields
    if (!body.phone || typeof body.phone !== 'string') {
      return reply.status(400).send({ error: 'phone is required (string)', code: 'INVALID_PHONE' });
    }
    if (!body.inboxId || typeof body.inboxId !== 'string') {
      return reply.status(400).send({ error: 'inboxId is required (string)', code: 'INVALID_INBOX_ID' });
    }
    if (!body.content || typeof body.content !== 'string') {
      return reply.status(400).send({ error: 'content is required (string)', code: 'INVALID_CONTENT' });
    }

    const mode = (body.mode as string) || 'hitl';
    if (mode !== 'hitl' && mode !== 'direct') {
      return reply.status(400).send({ error: 'mode must be "hitl" or "direct"', code: 'INVALID_MODE' });
    }

    const accountId = request.apiKeyPayload!.accountId;

    try {
      const io = (fastify as any).io;
      const result = await externalService.sendExternalMessage(accountId, {
        phone: body.phone as string,
        inboxId: body.inboxId as string,
        content: body.content as string,
        mode,
        senderLabel: body.senderLabel as string | undefined,
        blockDelay: typeof body.blockDelay === 'number' ? body.blockDelay : undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      }, io);

      const statusCode = mode === 'hitl' ? 201 : 200;
      return reply.status(statusCode).send({ data: result });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
