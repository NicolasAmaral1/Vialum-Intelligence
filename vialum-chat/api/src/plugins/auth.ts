import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fjwt from '@fastify/jwt';
import { getEnv } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  accountId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload: JwtPayload;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const env = getEnv();

  await fastify.register(fjwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: '15m' },
  });

  fastify.decorate('authenticate', async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    try {
      const decoded = await request.jwtVerify<JwtPayload>();
      request.jwtPayload = decoded;
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized', code: 'INVALID_TOKEN' });
    }
  });

  // Multi-tenant guard: validates JWT accountId matches URL param
  fastify.decorate('tenantGuard', async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const jwtAccountId = request.jwtPayload?.accountId;
    if (!jwtAccountId) {
      return reply.status(403).send({ error: 'Forbidden', code: 'NO_ACCOUNT' });
    }
    const urlAccountId = (request.params as Record<string, string>).accountId;
    if (urlAccountId && urlAccountId !== jwtAccountId) {
      return reply.status(403).send({ error: 'Forbidden', code: 'ACCOUNT_MISMATCH' });
    }
  });

  // Admin guard: requires role admin or owner
  fastify.decorate('adminGuard', async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const role = request.jwtPayload?.role;
    if (role !== 'admin' && role !== 'owner') {
      return reply.status(403).send({ error: 'Forbidden', code: 'ADMIN_REQUIRED' });
    }
  });
}

export default fp(authPlugin, { name: 'auth' });
