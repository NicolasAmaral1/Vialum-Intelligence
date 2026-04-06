import { FastifyInstance } from 'fastify';
import * as groupsService from './groups.service.js';

const VALID_GROUP_TYPES = ['client', 'agency'];
const MAX_LIMIT = 100;

export async function groupRoutes(app: FastifyInstance) {
  // GET / — List groups
  app.get('/', async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const { groupType, inboxId, page, limit } = request.query as {
      groupType?: string;
      inboxId?: string;
      page?: string;
      limit?: string;
    };

    if (groupType && !VALID_GROUP_TYPES.includes(groupType)) {
      return reply.status(400).send({ error: 'groupType must be "client" or "agency"', code: 'INVALID_FIELD' });
    }

    const parsedPage = page ? parseInt(page, 10) : undefined;
    const parsedLimit = limit ? Math.min(parseInt(limit, 10), MAX_LIMIT) : undefined;

    if (parsedPage !== undefined && (isNaN(parsedPage) || parsedPage < 1)) {
      return reply.status(400).send({ error: 'page must be a positive integer', code: 'INVALID_FIELD' });
    }
    if (parsedLimit !== undefined && (isNaN(parsedLimit) || parsedLimit < 1)) {
      return reply.status(400).send({ error: 'limit must be a positive integer (max 100)', code: 'INVALID_FIELD' });
    }

    const result = await groupsService.findAll(accountId, {
      groupType,
      inboxId,
      page: parsedPage,
      limit: parsedLimit,
    });

    return reply.send(result);
  });

  // POST / — Create group (admin only)
  app.post('/', { onRequest: [(app as any).adminGuard] }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const body = request.body as {
      inboxId?: string;
      name?: string;
      participants?: string[];
      description?: string;
      groupType?: string;
    };

    if (!body.inboxId || !body.name) {
      return reply.status(400).send({ error: 'inboxId and name are required', code: 'MISSING_FIELD' });
    }
    if (!Array.isArray(body.participants) || body.participants.length === 0) {
      return reply.status(400).send({ error: 'participants must be a non-empty array of phone numbers', code: 'INVALID_FIELD' });
    }
    if (body.groupType && !VALID_GROUP_TYPES.includes(body.groupType)) {
      return reply.status(400).send({ error: 'groupType must be "client" or "agency"', code: 'INVALID_FIELD' });
    }

    const group = await groupsService.create(accountId, {
      inboxId: body.inboxId,
      name: body.name,
      participants: body.participants,
      description: body.description,
      groupType: (body.groupType as 'client' | 'agency') ?? undefined,
    });
    return reply.status(201).send({ data: group });
  });

  // GET /:groupId — Group detail
  app.get('/:groupId', async (request, reply) => {
    const { accountId, groupId } = request.params as { accountId: string; groupId: string };
    const group = await groupsService.findById(accountId, groupId);
    return reply.send({ data: group });
  });

  // PATCH /:groupId — Update group (admin only)
  app.patch('/:groupId', { onRequest: [(app as any).adminGuard] }, async (request, reply) => {
    const { accountId, groupId } = request.params as { accountId: string; groupId: string };
    const body = request.body as {
      name?: string;
      description?: string;
      groupType?: string;
    };

    if (body.groupType && !VALID_GROUP_TYPES.includes(body.groupType)) {
      return reply.status(400).send({ error: 'groupType must be "client" or "agency"', code: 'INVALID_FIELD' });
    }

    const group = await groupsService.update(accountId, groupId, {
      name: body.name,
      description: body.description,
      groupType: body.groupType as 'client' | 'agency' | undefined,
    });
    return reply.send({ data: group });
  });

  // POST /:groupId/sync — Sync from WhatsApp (admin only)
  app.post('/:groupId/sync', { onRequest: [(app as any).adminGuard] }, async (request, reply) => {
    const { accountId, groupId } = request.params as { accountId: string; groupId: string };
    const info = await groupsService.syncFromWhatsApp(accountId, groupId);
    return reply.send({ data: info });
  });

  // POST /:groupId/participants — Add participants (admin only)
  app.post('/:groupId/participants', { onRequest: [(app as any).adminGuard] }, async (request, reply) => {
    const { accountId, groupId } = request.params as { accountId: string; groupId: string };
    const body = request.body as { phones?: string[] };

    if (!Array.isArray(body.phones) || body.phones.length === 0) {
      return reply.status(400).send({ error: 'phones must be a non-empty array', code: 'INVALID_FIELD' });
    }

    const added = await groupsService.addParticipants(accountId, groupId, body.phones);
    return reply.status(201).send({ data: added });
  });

  // DELETE /:groupId/participants/:contactId — Remove participant (admin only)
  app.delete('/:groupId/participants/:contactId', { onRequest: [(app as any).adminGuard] }, async (request, reply) => {
    const { accountId, groupId, contactId } = request.params as {
      accountId: string;
      groupId: string;
      contactId: string;
    };

    await groupsService.removeParticipant(accountId, groupId, contactId);
    return reply.status(204).send();
  });

  // GET /:groupId/conversations — List group conversations
  app.get('/:groupId/conversations', async (request, reply) => {
    const { accountId, groupId } = request.params as { accountId: string; groupId: string };
    const conversations = await groupsService.listConversations(accountId, groupId);
    return reply.send({ data: conversations });
  });
}
