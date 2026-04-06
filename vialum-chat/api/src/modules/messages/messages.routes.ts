import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import * as messagesService from './messages.service.js';
import { getEnv } from '../../config/env.js';
import { getPrisma } from '../../config/database.js';

const listQuerySchema = z.object({
  before_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createMessageSchema = z.object({
  content: z.string().nullish(),
  messageType: z.enum(['outgoing', 'activity', 'template']).optional(),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'document', 'location', 'sticker', 'template']).optional(),
  contentAttributes: z.record(z.unknown()).optional(),
  private: z.boolean().optional(),
});

type MessageParams = { accountId: string; conversationId: string };

export async function messageRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: MessageParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    const query = listQuerySchema.parse(request.query);
    try {
      const result = await messagesService.list(accountId, conversationId, {
        beforeId: query.before_id,
        limit: query.limit,
      });
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /
  fastify.post('/', async (request: FastifyRequest<{ Params: MessageParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    const body = createMessageSchema.parse(request.body);
    const senderId = request.jwtPayload.userId;

    try {
      const message = await messagesService.create(accountId, conversationId, senderId, body);
      return reply.status(201).send({ data: message });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // GET /:messageId/media-url — Get presigned URL for message media
  fastify.get('/:messageId/media-url', async (
    request: FastifyRequest<{ Params: MessageParams & { messageId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId, messageId } = request.params;
    const prisma = getPrisma();
    const env = getEnv();

    const message = await prisma.message.findFirst({
      where: { id: messageId, accountId },
      select: { contentAttributes: true },
    });

    if (!message) {
      return reply.status(404).send({ error: 'Message not found' });
    }

    const attrs = message.contentAttributes as Record<string, unknown>;
    const mediaFileId = attrs?.mediaFileId as string | undefined;

    if (!mediaFileId) {
      return reply.status(404).send({ error: 'No media file associated with this message' });
    }

    // Generate service token for Media Service
    const secret = env.MEDIA_JWT_SECRET;
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
      userId: 'system', accountId, role: 'admin',
      iat: now, exp: now + 300,
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
    const token = `${header}.${payload}.${signature}`;

    // Proxy request to Media Service
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const mediaRes = await fetch(`${env.MEDIA_SERVICE_URL}/api/v1/files/${mediaFileId}/url`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!mediaRes.ok) {
        const errorText = await mediaRes.text().catch(() => 'Unknown error');
        return reply.status(mediaRes.status).send({ error: `Media service error: ${errorText}` });
      }

      const result = await mediaRes.json() as { data: { url: string; expiresAt: string } };
      return reply.send({ data: result.data });
    } catch {
      return reply.status(502).send({ error: 'Failed to reach media service' });
    }
  });
}
