// ════════════════════════════════════════════════════════════
// Organizations Routes — CRUD + contact linking
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as orgService from './organizations.service.js';

export async function organizationRoutes(fastify: FastifyInstance) {

  // POST / — Create organization
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    try {
      const org = await orgService.create(accountId, {
        legalName: body.legalName as string | undefined,
        tradeName: body.tradeName as string | undefined,
        cnpj: body.cnpj as string | undefined,
        lifecycleStage: body.lifecycleStage as string | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });
      return reply.status(201).send({ data: org });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /:orgId — Get by ID
  fastify.get('/:orgId', async (request: FastifyRequest<{ Params: { orgId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const org = await orgService.getById(accountId, request.params.orgId);
    if (!org) return reply.status(404).send({ error: 'Organization not found', code: 'NOT_FOUND' });
    return reply.send({ data: org });
  });

  // GET /?cnpj=X — Search by CNPJ
  fastify.get('/', async (request: FastifyRequest<{ Querystring: { cnpj?: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { cnpj } = request.query;
    if (!cnpj) return reply.status(400).send({ error: 'cnpj query parameter is required', code: 'MISSING_FIELD' });

    const org = await orgService.getByCnpj(accountId, cnpj);
    if (!org) return reply.status(404).send({ error: 'Organization not found', code: 'NOT_FOUND' });
    return reply.send({ data: org });
  });

  // PATCH /:orgId — Update
  fastify.patch('/:orgId', async (request: FastifyRequest<{ Params: { orgId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    try {
      const org = await orgService.update(accountId, request.params.orgId, {
        legalName: body.legalName as string | undefined,
        tradeName: body.tradeName as string | undefined,
        lifecycleStage: body.lifecycleStage as string | undefined,
        metadata: body.metadata as Record<string, unknown> | undefined,
      });
      return reply.send({ data: org });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // POST /:orgId/contacts — Link contact to org
  fastify.post('/:orgId/contacts', async (request: FastifyRequest<{ Params: { orgId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.contactId) return reply.status(400).send({ error: 'contactId is required', code: 'MISSING_FIELD' });

    try {
      const link = await orgService.linkContact(
        accountId,
        body.contactId as string,
        request.params.orgId,
        body.role as string | undefined,
        body.isPrimary as boolean | undefined,
      );
      return reply.status(201).send({ data: link });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /:orgId/contacts — List contacts of org
  fastify.get('/:orgId/contacts', async (request: FastifyRequest<{ Params: { orgId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const contacts = await orgService.getOrganizationContacts(accountId, request.params.orgId);
    return reply.send({ data: contacts });
  });

  // DELETE /:orgId/contacts/:contactId — Unlink contact
  fastify.delete('/:orgId/contacts/:contactId', async (
    request: FastifyRequest<{ Params: { orgId: string; contactId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    await orgService.unlinkContact(accountId, request.params.contactId, request.params.orgId);
    return reply.send({ success: true });
  });
}
