import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { jwtAuth } from './lib/jwt-auth.js';
import { processRoutes } from './modules/process/process.routes.js';
import { webhookRoutes } from './modules/webhooks/webhook.routes.js';
import { configRoutes } from './modules/config/config.routes.js';
import { initProcessors } from './processors/index.js';
import { initProviderExecutors } from './providers/index.js';

const fastify = Fastify({ logger: true });

async function start() {
  initProcessors();
  initProviderExecutors();

  await fastify.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });

  fastify.get('/switch/health', async () => ({ status: 'ok', service: 'vialum-switch' }));

  // Webhook routes (no JWT — internal service-to-service, uses secret)
  fastify.register(webhookRoutes, { prefix: '/switch/api/v1' });

  // API routes (JWT auth required)
  fastify.register(async (app) => {
    app.addHook('onRequest', jwtAuth);
    app.register(processRoutes, { prefix: '/' });
    app.register(configRoutes, { prefix: '/config' });
  }, { prefix: '/switch/api/v1' });

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`Vialum Switch running on port ${env.PORT}`);
}

start().catch((err) => {
  console.error('Failed to start Vialum Switch:', err);
  process.exit(1);
});
