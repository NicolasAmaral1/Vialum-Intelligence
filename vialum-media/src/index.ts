import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { jwtAuth } from './lib/jwt-auth.js';
import { fileRoutes } from './modules/files/files.routes.js';

// BigInt serialization support (Prisma returns BigInt for sizeBytes)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

const fastify = Fastify({ logger: true });

async function start() {
  await fastify.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

  // Health check (no auth)
  fastify.get('/media/health', async () => ({ status: 'ok', service: 'vialum-media' }));

  // All API routes require JWT auth (same JWT as CRM Hub and Vialum Chat)
  fastify.register(async (app) => {
    app.addHook('onRequest', jwtAuth);
    app.register(fileRoutes, { prefix: '/' });
  }, { prefix: '/media/api/v1' });

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Media Service running on port ${env.PORT}`);
}

start().catch((err) => {
  console.error('Failed to start Media Service:', err);
  process.exit(1);
});
