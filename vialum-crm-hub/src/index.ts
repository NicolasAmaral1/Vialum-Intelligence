import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { jwtAuth } from './middleware/jwt-auth.js';
import { contactRoutes } from './modules/contacts/contacts.routes.js';
import { integrationRoutes } from './modules/integrations/integrations.routes.js';
import { pipedriveRoutes } from './modules/pipedrive/pipedrive.routes.js';
import { clickupRoutes } from './modules/clickup/clickup.routes.js';
import { gdriveRoutes } from './modules/gdrive/gdrive.routes.js';
import { providerRoutes } from './modules/providers.js';
import { oauthRoutes } from './modules/oauth/oauth.routes.js';
import { identityRoutes } from './modules/identity/identity.routes.js';
import { agentRoutes } from './modules/agent/agent.routes.js';
import { groupRoutes } from './modules/groups/groups.routes.js';
import { taskRoutes } from './modules/tasks/tasks.routes.js';
import { organizationRoutes } from './modules/organizations/organizations.routes.js';
import { initProviders } from './providers/index.js';

const fastify = Fastify({ logger: true });

async function start() {
  // Register all providers in the registry
  initProviders();

  // CORS
  await fastify.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });

  // Health check (no auth)
  fastify.get('/crm/health', async () => ({ status: 'ok', service: 'vialum-crm-hub' }));

  // OAuth routes (callback needs no auth — external redirect)
  fastify.register(oauthRoutes, { prefix: '/crm/api/v1/oauth' });

  // All API routes require JWT auth
  fastify.register(async (app) => {
    app.addHook('onRequest', jwtAuth);

    app.register(contactRoutes, { prefix: '/contacts' });
    app.register(integrationRoutes, { prefix: '/' });
    app.register(providerRoutes, { prefix: '/providers' });
    app.register(pipedriveRoutes, { prefix: '/pipedrive' });
    app.register(clickupRoutes, { prefix: '/clickup' });
    app.register(gdriveRoutes, { prefix: '/gdrive' });
    app.register(identityRoutes, { prefix: '/identity' });
    app.register(agentRoutes, { prefix: '/agent' });
    app.register(groupRoutes, { prefix: '/groups' });
    app.register(taskRoutes, { prefix: '/tasks' });
    app.register(organizationRoutes, { prefix: '/organizations' });
  }, { prefix: '/crm/api/v1' });

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`CRM Hub running on port ${env.PORT}`);

  // Initialize BullMQ workers
  const { initializeWorkers } = await import('./workers/index.js');
  await initializeWorkers();
}

start().catch((err) => {
  console.error('Failed to start CRM Hub:', err);
  process.exit(1);
});
