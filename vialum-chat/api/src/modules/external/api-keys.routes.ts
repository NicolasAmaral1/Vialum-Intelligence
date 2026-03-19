import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as apiKeysService from './api-keys.service.js';

export async function apiKeyRoutes(fastify: FastifyInstance) {
  // List API keys
  fastify.get('/', async (
    request: FastifyRequest<{ Params: { accountId: string } }>,
    reply: FastifyReply,
  ) => {
    const keys = await apiKeysService.listApiKeys(request.params.accountId);
    return reply.send({ data: keys });
  });

  // Create API key — admin only
  fastify.post('/', { onRequest: [(fastify as any).adminGuard] }, async (
    request: FastifyRequest<{
      Params: { accountId: string };
      Body: { name: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { name } = request.body as { name: string };

    if (!name || typeof name !== 'string' || name.length < 2) {
      return reply.status(400).send({ error: 'Name is required (min 2 chars)', code: 'INVALID_NAME' });
    }

    const result = await apiKeysService.createApiKey(request.params.accountId, name);
    return reply.status(201).send({ data: result });
  });

  // Deactivate API key — admin only
  fastify.delete('/:keyId', { onRequest: [(fastify as any).adminGuard] }, async (
    request: FastifyRequest<{ Params: { accountId: string; keyId: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const result = await apiKeysService.deleteApiKey(request.params.accountId, request.params.keyId);
      return reply.send({ data: result });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
