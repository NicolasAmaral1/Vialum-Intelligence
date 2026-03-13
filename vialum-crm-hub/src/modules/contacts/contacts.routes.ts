import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as contactsService from './contacts.service.js';

export async function contactRoutes(fastify: FastifyInstance) {
  // GET /:vialumContactId — full contact with integrations
  fastify.get('/:vialumContactId', async (request: FastifyRequest<{ Params: { vialumContactId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const contact = await contactsService.findByVialumContactId(accountId, request.params.vialumContactId);

    if (!contact) {
      return reply.status(404).send({ error: 'CRM contact not found', code: 'CRM_CONTACT_NOT_FOUND' });
    }

    return reply.send({ data: contact });
  });

  // GET /:vialumContactId/summary — compact for sidebar (auto-syncs providers)
  fastify.get('/:vialumContactId/summary', async (request: FastifyRequest<{
    Params: { vialumContactId: string };
    Querystring: { phone?: string; name?: string; email?: string };
  }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string | undefined>;
    const summary = await contactsService.getSummary(accountId, request.params.vialumContactId, {
      phone: query.phone,
      name: query.name,
      email: query.email,
    });
    return reply.send({ data: summary });
  });

  // POST /lookup — find or create CRM contact
  fastify.post('/lookup', async (request: FastifyRequest<{ Body: { vialumContactId: string; phone?: string; email?: string; name?: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.vialumContactId) {
      return reply.status(400).send({ error: 'vialumContactId is required', code: 'MISSING_FIELD' });
    }

    const contact = await contactsService.lookup(accountId, {
      vialumContactId: body.vialumContactId as string,
      phone: body.phone as string | undefined,
      email: body.email as string | undefined,
      name: body.name as string | undefined,
    });

    return reply.status(200).send({ data: contact });
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
