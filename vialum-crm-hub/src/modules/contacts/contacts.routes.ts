import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as contactsService from './contacts.service.js';
import { ensureContact } from './ensure.service.js';

export async function contactRoutes(fastify: FastifyInstance) {
  // GET /:externalSourceId — full contact with integrations
  fastify.get('/:externalSourceId', async (request: FastifyRequest<{ Params: { externalSourceId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const contact = await contactsService.findByVialumContactId(accountId, request.params.externalSourceId);

    if (!contact) {
      return reply.status(404).send({ error: 'CRM contact not found', code: 'CRM_CONTACT_NOT_FOUND' });
    }

    return reply.send({ data: contact });
  });

  // GET /:externalSourceId/summary — compact for sidebar (auto-syncs providers)
  fastify.get('/:externalSourceId/summary', async (request: FastifyRequest<{
    Params: { externalSourceId: string };
    Querystring: { phone?: string; name?: string; email?: string };
  }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string | undefined>;
    const summary = await contactsService.getSummary(accountId, request.params.externalSourceId, {
      phone: query.phone,
      name: query.name,
      email: query.email,
    });
    return reply.send({ data: summary });
  });

  // POST /lookup — find or create CRM contact
  fastify.post('/lookup', async (request: FastifyRequest<{ Body: { externalSourceId: string; phone?: string; email?: string; name?: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.externalSourceId) {
      return reply.status(400).send({ error: 'externalSourceId is required', code: 'MISSING_FIELD' });
    }

    const contact = await contactsService.lookup(accountId, {
      externalSourceId: body.externalSourceId as string,
      phone: body.phone as string | undefined,
      email: body.email as string | undefined,
      name: body.name as string | undefined,
    });

    return reply.status(200).send({ data: contact });
  });

  // POST /ensure — atomic find-or-create (used by Chat, Portal, etc.)
  fastify.post('/ensure', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.phone && !body.sourceId) {
      return reply.status(400).send({ error: 'phone or sourceId is required', code: 'MISSING_FIELD' });
    }

    const result = await ensureContact({
      accountId,
      phone: body.phone as string | undefined,
      email: body.email as string | undefined,
      name: body.name as string | undefined,
      nameSource: body.nameSource as string | undefined,
      sourceId: body.sourceId as string | undefined,
      source: body.source as string | undefined,
    });

    return reply.status(result.isNew ? 201 : 200).send({ data: result });
  });

  // PATCH /:id — update tags/metadata
  fastify.patch('/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: { tags?: string[]; metadata?: Record<string, unknown> } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    try {
      const contact = await contactsService.update(accountId, request.params.id, {
        tags: body.tags as string[] | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });
      return reply.send({ data: contact });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
