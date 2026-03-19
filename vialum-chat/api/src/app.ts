import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './config/env.js';
import { getRedis } from './config/redis.js';
import authPlugin from './plugins/auth.js';
import apiKeyAuthPlugin from './plugins/api-key-auth.js';
import socketPlugin from './plugins/socket.js';

// Route modules
import { authRoutes } from './modules/auth/auth.routes.js';
import { inboxRoutes } from './modules/inboxes/inboxes.routes.js';
import { contactRoutes } from './modules/contacts/contacts.routes.js';
import { conversationRoutes } from './modules/conversations/conversations.routes.js';
import { messageRoutes } from './modules/messages/messages.routes.js';
import { labelRoutes } from './modules/labels/labels.routes.js';
import { cannedResponseRoutes } from './modules/canned-responses/canned-responses.routes.js';
import { automationRoutes } from './modules/automation/automation.routes.js';
import { aiSuggestionRoutes } from './modules/ai-suggestions/ai-suggestions.routes.js';
import { treeFlowRoutes } from './modules/treeflow/treeflow.routes.js';
import { talkRoutes } from './modules/talks/talks.routes.js';
import { objectionRoutes } from './modules/objections/objections.routes.js';
import { webhookRoutes } from './webhooks/webhook.routes.js';
import { externalRoutes } from './modules/external/external.routes.js';
import { apiKeyRoutes } from './modules/external/api-keys.routes.js';
import { groupRoutes } from './modules/groups/groups.routes.js';
import { userRoutes } from './modules/users/users.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const env = getEnv();

  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // CORS
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // Rate limiting
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: getRedis(),
  });

  // Auth plugins
  await app.register(authPlugin);
  await app.register(apiKeyAuthPlugin);

  // Socket.io plugin
  await app.register(socketPlugin);

  // Health check
  app.get('/chat/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Public webhook routes (no auth)
  await app.register(webhookRoutes, { prefix: '/chat/webhooks' });

  // Auth routes
  await app.register(authRoutes, { prefix: '/chat/api/v1/auth' });

  // External API routes (API Key auth)
  await app.register(externalRoutes, { prefix: '/chat/api/v1/external' });

  // Protected API routes
  await app.register(async function protectedRoutes(instance) {
    instance.addHook('onRequest', (instance as any).authenticate);
    instance.addHook('onRequest', (instance as any).tenantGuard);

    await instance.register(inboxRoutes, { prefix: '/chat/api/v1/accounts/:accountId/inboxes' });
    await instance.register(contactRoutes, { prefix: '/chat/api/v1/accounts/:accountId/contacts' });
    await instance.register(conversationRoutes, { prefix: '/chat/api/v1/accounts/:accountId/conversations' });
    await instance.register(messageRoutes, { prefix: '/chat/api/v1/accounts/:accountId/conversations/:conversationId/messages' });
    await instance.register(labelRoutes, { prefix: '/chat/api/v1/accounts/:accountId/labels' });
    await instance.register(cannedResponseRoutes, { prefix: '/chat/api/v1/accounts/:accountId/canned-responses' });
    await instance.register(automationRoutes, { prefix: '/chat/api/v1/accounts/:accountId/automation-rules' });
    await instance.register(aiSuggestionRoutes, { prefix: '/chat/api/v1/accounts/:accountId/ai-suggestions' });
    await instance.register(treeFlowRoutes, { prefix: '/chat/api/v1/accounts/:accountId/tree-flows' });
    await instance.register(talkRoutes, { prefix: '/chat/api/v1/accounts/:accountId/talks' });
    await instance.register(objectionRoutes, { prefix: '/chat/api/v1/accounts/:accountId/objections' });
    await instance.register(apiKeyRoutes, { prefix: '/chat/api/v1/accounts/:accountId/api-keys' });
    await instance.register(groupRoutes, { prefix: '/chat/api/v1/accounts/:accountId/groups' });
    await instance.register(userRoutes, { prefix: '/chat/api/v1/accounts/:accountId/users' });
  });

  return app;
}
