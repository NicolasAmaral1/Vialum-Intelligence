import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as cannedResponsesService from './canned-responses.service.js';

const createSchema = z.object({
  shortCode: z.string().min(1).max(100),
  content: z.string().min(1),
});

const updateSchema = z.object({
  shortCode: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
});

type AccountParams = { accountId: string };
type ItemParams = { accountId: string; id: string };

export async function cannedResponseRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: AccountParams; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const { search } = listQuerySchema.parse(request.query);
    const data = await cannedResponsesService.findAll(accountId, search);
    return reply.status(200).send({ data });
  });

  // GET /search/:shortCode
  fastify.get('/search/:shortCode', async (request: FastifyRequest<{ Params: { accountId: string; shortCode: string } }>, reply: FastifyReply) => {
    const { accountId, shortCode } = request.params;
    try {
      const data = await cannedResponsesService.findByShortCode(accountId, shortCode);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // GET /:id
  fastify.get('/:id', async (request: FastifyRequest<{ Params: ItemParams }>, reply: FastifyReply) => {
    const { accountId, id } = request.params;
    try {
      const data = await cannedResponsesService.findById(accountId, id);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST / — admin only
  fastify.post('/', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createSchema.parse(request.body);
    const data = await cannedResponsesService.create(accountId, body);
    return reply.status(201).send({ data });
  });

  // PUT /:id — admin only
  fastify.put('/:id', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: ItemParams }>, reply: FastifyReply) => {
    const { accountId, id } = request.params;
    const body = updateSchema.parse(request.body);
    try {
      const data = await cannedResponsesService.update(accountId, id, body);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:id — admin only
  fastify.delete('/:id', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: ItemParams }>, reply: FastifyReply) => {
    const { accountId, id } = request.params;
    try {
      await cannedResponsesService.remove(accountId, id);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
