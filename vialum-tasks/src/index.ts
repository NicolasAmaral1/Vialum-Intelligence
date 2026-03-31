import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { getPrisma } from './config/database.js';
import { jwtAuth } from './lib/jwt-auth.js';
import { initSocketIO } from './plugins/websocket.js';
import { stopAllSessions } from './session/session-manager.js';
import { stopAllSquadSessions } from './adapters/squad/squad.adapter.js';
import { registerAdapter } from './adapters/adapter.registry.js';
import { SquadAdapter } from './adapters/squad/squad.adapter.js';
import { recoverStaleSteps } from './engine/execution-engine.js';
import { definitionRoutes } from './modules/definitions/definitions.routes.js';
import { workflowRoutes } from './modules/workflows/workflows.routes.js';
import { approvalRoutes } from './modules/approvals/approvals.routes.js';
import { eventRoutes } from './modules/events/events.routes.js';
import { commandRoutes } from './modules/commands/commands.routes.js';
import { inboxRoutes } from './modules/inbox/inbox.routes.js';
import { stepRoutes } from './modules/steps/steps.routes.js';

const fastify = Fastify({ logger: true });

// ═══ Register adapters ═══
registerAdapter(new SquadAdapter());

async function recoverStaleWorkflows() {
  const prisma = getPrisma();

  // Legacy recovery: mark running/hitl workflows as paused
  const stale = await prisma.workflow.updateMany({
    where: { status: { in: ['running', 'hitl'] }, deletedAt: null, definitionVersion: 0 },
    data: { status: 'paused' },
  });
  if (stale.count > 0) {
    fastify.log.warn(`Recovered ${stale.count} stale legacy workflow(s) → paused`);
  }

  // v2 recovery: recover engine steps and sessions
  await recoverStaleSteps();
}

async function start() {
  await fastify.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') });

  // Health check (no auth)
  fastify.get('/tasks/health', async () => ({
    status: 'ok',
    service: 'vialum-tasks',
    uptime: process.uptime(),
  }));

  // Webhook receivers (auth via secret, not JWT)
  fastify.register(eventRoutes, { prefix: '/tasks/api/v1' });

  // API routes (JWT auth required)
  fastify.register(async (app) => {
    app.addHook('onRequest', jwtAuth);

    // Legacy + shared
    app.register(definitionRoutes, { prefix: '/definitions' });
    app.register(workflowRoutes, { prefix: '/workflows' });
    app.register(approvalRoutes, { prefix: '/approvals' });
    app.register(commandRoutes, { prefix: '/commands' });

    // v2: inbox + steps
    app.register(inboxRoutes, { prefix: '/inbox' });
    app.register(stepRoutes, { prefix: '/workflows' });
  }, { prefix: '/tasks/api/v1' });

  // Recover stale workflows from previous crash
  await recoverStaleWorkflows();

  // Start HTTP server + Socket.IO
  await fastify.ready();
  const httpServer = fastify.server;
  await initSocketIO(httpServer);

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Vialum Tasks running on port ${env.PORT}`);
}

// Graceful shutdown
async function shutdown(signal: string) {
  fastify.log.info(`${signal} received — shutting down`);

  // Stop legacy sessions
  await stopAllSessions();
  // Stop v2 squad sessions
  await stopAllSquadSessions();

  await fastify.close();

  const prisma = getPrisma();
  await prisma.$disconnect();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  console.error('Failed to start Vialum Tasks:', err);
  process.exit(1);
});
