import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as conversationsService from './conversations.service.js';
import * as contextService from './context.service.js';

const listQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'snoozed']).optional(),
  inboxId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  assigneeId: z.string().optional(), // uuid or 'unassigned'
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createConversationSchema = z.object({
  inboxId: z.string().uuid(),
  contactId: z.string().uuid(),
  contactInboxId: z.string().uuid().nullish(),
  assigneeId: z.string().uuid().nullish(),
  status: z.enum(['open', 'pending']).optional(),
  customAttributes: z.record(z.unknown()).optional(),
  additionalAttributes: z.record(z.unknown()).optional(),
});

const updateConversationSchema = z.object({
  assigneeId: z.string().uuid().nullish(),
  status: z.enum(['open', 'pending', 'resolved', 'snoozed']).optional(),
  customAttributes: z.record(z.unknown()).optional(),
  additionalAttributes: z.record(z.unknown()).optional(),
  snoozedUntil: z.string().datetime().nullish(),
});

const labelBodySchema = z.object({
  labelId: z.string().uuid(),
});

type AccountParams = { accountId: string };
type ConversationParams = { accountId: string; conversationId: string };

export async function conversationRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: AccountParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const filters = listQuerySchema.parse(request.query);
    // Pass userId for RLS inbox filtering
    const result = await conversationsService.findAll(accountId, {
      ...filters,
      userId: request.jwtPayload.userId,
    });
    return reply.status(200).send(result);
  });

  // POST /
  fastify.post('/', async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createConversationSchema.parse(request.body);
    const conversation = await conversationsService.create(accountId, body);
    return reply.status(201).send({ data: conversation });
  });

  // GET /:conversationId/context — Full conversation context for AI/operators
  fastify.get('/:conversationId/context', async (request: FastifyRequest<{ Params: ConversationParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    const query = z.object({
      limit: z.coerce.number().int().min(1).max(100).optional(),
      includeTextContent: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    }).parse(request.query);

    try {
      const context = await contextService.getConversationContext(accountId, conversationId, request.jwtPayload.userId, {
        limit: query.limit,
        includeTextContent: query.includeTextContent,
      });
      return reply.status(200).send({ data: context });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // GET /:conversationId
  fastify.get('/:conversationId', async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    try {
      const conversation = await conversationsService.findById(accountId, conversationId);
      return reply.status(200).send({ data: conversation });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // PATCH /:conversationId
  fastify.patch('/:conversationId', async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    const body = updateConversationSchema.parse(request.body);
    try {
      const conversation = await conversationsService.update(accountId, conversationId, body);
      return reply.status(200).send({ data: conversation });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /:conversationId/resolve
  fastify.post('/:conversationId/resolve', async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    try {
      const conversation = await conversationsService.resolve(accountId, conversationId);
      return reply.status(200).send({ data: conversation });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /:conversationId/reopen
  fastify.post('/:conversationId/reopen', async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    try {
      const conversation = await conversationsService.reopen(accountId, conversationId);
      return reply.status(200).send({ data: conversation });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /:conversationId/labels
  fastify.post('/:conversationId/labels', async (request: FastifyRequest<{ Params: ConversationParams }>, reply: FastifyReply) => {
    const { accountId, conversationId } = request.params;
    const { labelId } = labelBodySchema.parse(request.body);
    try {
      const result = await conversationsService.addLabel(accountId, conversationId, labelId);
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:conversationId/labels/:labelId
  fastify.delete('/:conversationId/labels/:labelId', async (
    request: FastifyRequest<{ Params: { accountId: string; conversationId: string; labelId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId, conversationId, labelId } = request.params;
    try {
      await conversationsService.removeLabel(accountId, conversationId, labelId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
