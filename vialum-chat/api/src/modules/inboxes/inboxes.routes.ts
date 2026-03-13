import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as inboxesService from './inboxes.service.js';

const createInboxSchema = z.object({
  name: z.string().min(1).max(255),
  channelType: z.string().max(50).optional(),
  provider: z.enum(['evolution_api', 'cloud_api']),
  providerConfig: z.record(z.unknown()).optional(),
  workingHours: z.record(z.unknown()).optional(),
  greetingMessage: z.string().nullish(),
  outOfOfficeMessage: z.string().nullish(),
});

const updateInboxSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  providerConfig: z.record(z.unknown()).optional(),
  workingHours: z.record(z.unknown()).optional(),
  greetingMessage: z.string().nullish(),
  outOfOfficeMessage: z.string().nullish(),
});

export async function inboxRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const inboxes = await inboxesService.findAll(accountId);
    return reply.status(200).send({ data: inboxes });
  });

  // GET /:inboxId
  fastify.get('/:inboxId', async (request: FastifyRequest<{ Params: { accountId: string; inboxId: string } }>, reply: FastifyReply) => {
    const { accountId, inboxId } = request.params;
    try {
      const inbox = await inboxesService.findById(accountId, inboxId);
      return reply.status(200).send({ data: inbox });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /
  fastify.post('/', async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createInboxSchema.parse(request.body);
    const inbox = await inboxesService.create(accountId, body);
    return reply.status(201).send({ data: inbox });
  });

  // PUT /:inboxId
  fastify.put('/:inboxId', async (request: FastifyRequest<{ Params: { accountId: string; inboxId: string } }>, reply: FastifyReply) => {
    const { accountId, inboxId } = request.params;
    const body = updateInboxSchema.parse(request.body);
    try {
      const inbox = await inboxesService.update(accountId, inboxId, body);
      return reply.status(200).send({ data: inbox });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:inboxId
  fastify.delete('/:inboxId', async (request: FastifyRequest<{ Params: { accountId: string; inboxId: string } }>, reply: FastifyReply) => {
    const { accountId, inboxId } = request.params;
    try {
      await inboxesService.remove(accountId, inboxId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
