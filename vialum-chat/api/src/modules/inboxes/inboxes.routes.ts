import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as inboxesService from './inboxes.service.js';
import { getAccessibleInboxIds } from './inbox-access.service.js';

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
  // GET / — returns all accessible inboxes with `isMine` flag
  fastify.get('/', async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const userId = request.jwtPayload.userId;
    const role = request.jwtPayload.role;
    const allInboxes = await inboxesService.findAll(accountId);

    // Get user's own inbox IDs
    const myInboxIds = await inboxesService.getMyInboxIds(accountId, userId);

    // RLS: filter by accessible inboxes
    const accessibleIds = await getAccessibleInboxIds(accountId, userId);
    const filteredInboxes = accessibleIds === null
      ? allInboxes // admin/owner can see all
      : allInboxes.filter((inbox) => accessibleIds.includes(inbox.id));

    // Annotate with isMine
    const inboxes = filteredInboxes.map((inbox) => ({
      ...inbox,
      isMine: myInboxIds.includes(inbox.id),
    }));

    const canSeeAll = role === 'admin' || role === 'owner';

    return reply.status(200).send({ data: inboxes, meta: { canSeeAll } });
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

  // POST / — admin only
  fastify.post('/', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createInboxSchema.parse(request.body);
    const inbox = await inboxesService.create(accountId, body);
    return reply.status(201).send({ data: inbox });
  });

  // PUT /:inboxId — admin only
  fastify.put('/:inboxId', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: { accountId: string; inboxId: string } }>, reply: FastifyReply) => {
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

  // DELETE /:inboxId — admin only
  fastify.delete('/:inboxId', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: { accountId: string; inboxId: string } }>, reply: FastifyReply) => {
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
