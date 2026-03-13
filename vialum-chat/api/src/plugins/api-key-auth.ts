import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'node:crypto';
import { getPrisma } from '../config/database.js';

export interface ApiKeyPayload {
  accountId: string;
  keyName: string;
  keyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyPayload?: ApiKeyPayload;
  }
}

async function apiKeyAuthPlugin(fastify: FastifyInstance) {
  fastify.decorate('authenticateApiKey', async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      return reply.status(401).send({ error: 'Missing x-api-key header', code: 'MISSING_API_KEY' });
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const prisma = getPrisma();

    const record = await prisma.accountApiKey.findUnique({
      where: { keyHash },
      select: { id: true, accountId: true, name: true, active: true, expiresAt: true },
    });

    if (!record) {
      return reply.status(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' });
    }

    if (!record.active) {
      return reply.status(401).send({ error: 'API key is deactivated', code: 'API_KEY_INACTIVE' });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'API key has expired', code: 'API_KEY_EXPIRED' });
    }

    request.apiKeyPayload = {
      accountId: record.accountId,
      keyName: record.name,
      keyId: record.id,
    };

    // Update lastUsedAt (fire-and-forget)
    prisma.accountApiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => { /* ignore */ });
  });
}

export default fp(apiKeyAuthPlugin, { name: 'api-key-auth' });
