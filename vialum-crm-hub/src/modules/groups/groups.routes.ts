import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as groupsService from './groups.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUP_JID_REGEX = /^\d+@g\.us$/;
const VALID_GROUP_TYPES = ['client', 'agency'];

export async function groupRoutes(fastify: FastifyInstance) {
  // POST /mappings — register or update a group mapping
  fastify.post('/mappings', async (
    request: FastifyRequest<{
      Body: { groupJid: string; crmContactId: string; groupName?: string; groupType?: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.groupJid || !body.crmContactId) {
      return reply.status(400).send({
        error: 'groupJid and crmContactId are required',
        code: 'MISSING_FIELD',
      });
    }

    const groupJid = String(body.groupJid);
    const crmContactId = String(body.crmContactId);

    if (!GROUP_JID_REGEX.test(groupJid)) {
      return reply.status(400).send({
        error: 'groupJid must be a valid WhatsApp group JID (e.g. 120363XXXXX@g.us)',
        code: 'INVALID_FIELD',
      });
    }

    if (!UUID_REGEX.test(crmContactId)) {
      return reply.status(400).send({
        error: 'crmContactId must be a valid UUID',
        code: 'INVALID_FIELD',
      });
    }

    if (body.groupType && !VALID_GROUP_TYPES.includes(String(body.groupType))) {
      return reply.status(400).send({
        error: 'groupType must be "client" or "agency"',
        code: 'INVALID_FIELD',
      });
    }

    try {
      const mapping = await groupsService.registerGroupMapping(accountId, {
        groupJid,
        crmContactId,
        groupName: body.groupName ? String(body.groupName) : undefined,
        groupType: body.groupType ? String(body.groupType) : undefined,
      });

      return reply.status(200).send({ data: mapping });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // GET /resolve?groupJid=X — resolve a group JID to a CRM contact
  fastify.get('/resolve', async (
    request: FastifyRequest<{ Querystring: { groupJid?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string | undefined>;

    if (!query.groupJid) {
      return reply.status(400).send({
        error: 'groupJid query parameter is required',
        code: 'MISSING_FIELD',
      });
    }

    if (!GROUP_JID_REGEX.test(query.groupJid)) {
      return reply.status(400).send({
        error: 'groupJid must be a valid WhatsApp group JID (e.g. 120363XXXXX@g.us)',
        code: 'INVALID_FIELD',
      });
    }

    const result = await groupsService.resolveByGroupJid(accountId, query.groupJid);

    if (!result) {
      return reply.status(404).send({
        error: 'No mapping found for this group JID',
        code: 'GROUP_MAPPING_NOT_FOUND',
      });
    }

    return reply.send({ data: result });
  });

  // GET /contact/:crmContactId — list all group mappings for a contact
  fastify.get('/contact/:crmContactId', async (
    request: FastifyRequest<{ Params: { crmContactId: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;

    if (!UUID_REGEX.test(request.params.crmContactId)) {
      return reply.status(400).send({
        error: 'crmContactId must be a valid UUID',
        code: 'INVALID_FIELD',
      });
    }

    const mappings = await groupsService.listGroupsForContact(accountId, request.params.crmContactId);
    return reply.send({ data: mappings });
  });

  // DELETE /mappings/:groupJid — remove a group mapping
  fastify.delete('/mappings/:groupJid', async (
    request: FastifyRequest<{ Params: { groupJid: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;

    try {
      await groupsService.removeGroupMapping(accountId, request.params.groupJid);
      return reply.send({ data: { deleted: true } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
