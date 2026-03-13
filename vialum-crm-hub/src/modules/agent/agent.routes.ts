import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as agentService from './agent.service.js';
import type { QueryIntent } from './agent.service.js';

const VALID_INTENTS: QueryIntent[] = ['deal_status', 'open_tasks', 'documents', 'full_profile', 'client_info'];

export async function agentRoutes(fastify: FastifyInstance) {
  // POST /agent/query — intent-based query for AI agents
  fastify.post('/query', async (
    request: FastifyRequest<{
      Body: {
        intent: string;
        identifier: { phone?: string; email?: string; name?: string; groupJid?: string };
        filters?: { provider?: string; status?: string };
      };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    const intent = body.intent as string;
    if (!intent || !VALID_INTENTS.includes(intent as QueryIntent)) {
      return reply.status(400).send({
        error: `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}`,
        code: 'INVALID_INTENT',
      });
    }

    const identifier = body.identifier as Record<string, string> | undefined;
    if (!identifier || (!identifier.phone && !identifier.email && !identifier.name && !identifier.groupJid)) {
      return reply.status(400).send({
        error: 'identifier is required with at least one of: phone, email, name, groupJid',
        code: 'MISSING_IDENTIFIER',
      });
    }

    try {
      const result = await agentService.query(accountId, {
        intent: intent as QueryIntent,
        identifier: {
          phone: identifier.phone,
          email: identifier.email,
          name: identifier.name,
          groupJid: identifier.groupJid,
        },
        filters: body.filters as { provider?: string; status?: string } | undefined,
      });

      return reply.send({ data: result });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // GET /agent/status?phone=X — shortcut for full_profile by phone
  fastify.get('/status', async (
    request: FastifyRequest<{ Querystring: { phone?: string; email?: string; name?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;

    if (!query.phone && !query.email && !query.name) {
      return reply.status(400).send({
        error: 'At least one query parameter is required: phone, email, or name',
        code: 'MISSING_IDENTIFIER',
      });
    }

    try {
      const result = await agentService.query(accountId, {
        intent: 'full_profile',
        identifier: {
          phone: query.phone,
          email: query.email,
          name: query.name,
        },
      });

      return reply.send({ data: result });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
