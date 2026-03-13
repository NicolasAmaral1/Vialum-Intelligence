import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as messagesService from './messages.service.js';

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
}
