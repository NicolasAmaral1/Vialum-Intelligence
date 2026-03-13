import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as contactsService from './contacts.service.js';

const createContactSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().max(50).nullish(),
  email: z.string().email().max(255).nullish(),
  avatarUrl: z.string().url().nullish(),
  customAttributes: z.record(z.unknown()).optional(),
  funnelStage: z.string().max(100).nullish(),
  notes: z.string().nullish(),
});

const updateContactSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).nullish(),
  email: z.string().email().max(255).nullish(),
  avatarUrl: z.string().url().nullish(),
  customAttributes: z.record(z.unknown()).optional(),
  funnelStage: z.string().max(100).nullish(),
  notes: z.string().nullish(),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function contactRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: { accountId: string }; Querystring: Record<string, string> }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const query = listQuerySchema.parse(request.query);
    const result = await contactsService.findAll(accountId, query);
    return reply.status(200).send(result);
  });

  // GET /:contactId
  fastify.get('/:contactId', async (request: FastifyRequest<{ Params: { accountId: string; contactId: string } }>, reply: FastifyReply) => {
    const { accountId, contactId } = request.params;
    try {
      const contact = await contactsService.findById(accountId, contactId);
      return reply.status(200).send({ data: contact });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /
  fastify.post('/', async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createContactSchema.parse(request.body);
    const contact = await contactsService.create(accountId, body);
    return reply.status(201).send({ data: contact });
  });

  // PUT /:contactId
  fastify.put('/:contactId', async (request: FastifyRequest<{ Params: { accountId: string; contactId: string } }>, reply: FastifyReply) => {
    const { accountId, contactId } = request.params;
    const body = updateContactSchema.parse(request.body);
    try {
      const contact = await contactsService.update(accountId, contactId, body);
      return reply.status(200).send({ data: contact });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:contactId (soft delete)
  fastify.delete('/:contactId', async (request: FastifyRequest<{ Params: { accountId: string; contactId: string } }>, reply: FastifyReply) => {
    const { accountId, contactId } = request.params;
    try {
      await contactsService.softDelete(accountId, contactId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
