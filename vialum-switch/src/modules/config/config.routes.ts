// ════════════════════════════════════════════════════════════
// Config Routes — CRUD for auto-rules, classifiers, strategies, providers, webhooks
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../../config/database.js';

export async function configRoutes(fastify: FastifyInstance) {

  // ── AUTO-RULES ──────────────────────────────────────────

  fastify.get('/auto-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const rules = await prisma.switchAutoRule.findMany({ where: { accountId }, orderBy: { priority: 'desc' } });
    return reply.send({ data: rules });
  });

  fastify.post('/auto-rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const rule = await prisma.switchAutoRule.create({
      data: {
        accountId,
        name: body.name as string,
        source: (body.source as string) ?? '*',
        event: (body.event as string) ?? 'file.created',
        mimePattern: body.mimePattern as string,
        processors: body.processors as any,
        priority: (body.priority as number) ?? 0,
      },
    });
    return reply.status(201).send({ data: rule });
  });

  fastify.put('/auto-rules/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const rule = await prisma.switchAutoRule.updateMany({
      where: { id: request.params.id, accountId },
      data: {
        ...(body.name !== undefined && { name: body.name as string }),
        ...(body.mimePattern !== undefined && { mimePattern: body.mimePattern as string }),
        ...(body.processors !== undefined && { processors: body.processors as any }),
        ...(body.active !== undefined && { active: body.active as boolean }),
        ...(body.priority !== undefined && { priority: body.priority as number }),
      },
    });
    return reply.send({ updated: rule.count });
  });

  fastify.delete('/auto-rules/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    await prisma.switchAutoRule.deleteMany({ where: { id: request.params.id, accountId } });
    return reply.send({ success: true });
  });

  // ── CLASSIFIERS ─────────────────────────────────────────

  fastify.get('/classifiers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const classifiers = await prisma.switchClassifier.findMany({ where: { accountId } });
    return reply.send({ data: classifiers });
  });

  fastify.post('/classifiers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const classifier = await prisma.switchClassifier.upsert({
      where: { accountId_name: { accountId, name: body.name as string } },
      create: {
        accountId,
        name: body.name as string,
        description: body.description as string ?? null,
        labels: body.labels as any,
      },
      update: {
        description: body.description as string ?? null,
        labels: body.labels as any,
      },
    });
    return reply.status(201).send({ data: classifier });
  });

  fastify.delete('/classifiers/:name', async (request: FastifyRequest<{ Params: { name: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    await prisma.switchClassifier.deleteMany({ where: { accountId, name: request.params.name } });
    return reply.send({ success: true });
  });

  // ── STRATEGIES ──────────────────────────────────────────

  fastify.get('/strategies', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const strategies = await prisma.switchStrategy.findMany({ where: { accountId } });
    return reply.send({ data: strategies });
  });

  fastify.put('/strategies/:processor', async (request: FastifyRequest<{ Params: { processor: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const strategy = await prisma.switchStrategy.upsert({
      where: { accountId_processor: { accountId, processor: request.params.processor } },
      create: { accountId, processor: request.params.processor, strategy: body.strategy as any },
      update: { strategy: body.strategy as any },
    });
    return reply.send({ data: strategy });
  });

  // ── PROVIDER CONFIGS ────────────────────────────────────

  fastify.get('/providers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const configs = await prisma.switchProviderConfig.findMany({ where: { accountId } });
    // Don't expose credentials
    const safe = configs.map(c => ({ ...c, credentials: '***' }));
    return reply.send({ data: safe });
  });

  fastify.put('/providers/:provider', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const config = await prisma.switchProviderConfig.upsert({
      where: { accountId_provider: { accountId, provider: request.params.provider } },
      create: {
        accountId,
        provider: request.params.provider,
        credentials: (body.credentials ?? {}) as any,
        settings: (body.settings ?? {}) as any,
      },
      update: {
        ...(body.credentials !== undefined && { credentials: body.credentials as any }),
        ...(body.settings !== undefined && { settings: body.settings as any }),
        ...(body.active !== undefined && { active: body.active as boolean }),
      },
    });
    return reply.send({ data: { ...config, credentials: '***' } });
  });

  fastify.delete('/providers/:provider', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    await prisma.switchProviderConfig.deleteMany({ where: { accountId, provider: request.params.provider } });
    return reply.send({ success: true });
  });

  // ── WEBHOOK CONFIGS ─────────────────────────────────────

  fastify.get('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    const webhooks = await prisma.switchWebhookConfig.findMany({ where: { accountId } });
    return reply.send({ data: webhooks });
  });

  fastify.put('/webhooks', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const prisma = getPrisma();
    const webhook = await prisma.switchWebhookConfig.upsert({
      where: { accountId_url: { accountId, url: body.url as string } },
      create: {
        accountId,
        events: body.events as string[],
        url: body.url as string,
        secret: body.secret as string ?? null,
      },
      update: {
        events: body.events as string[],
        secret: body.secret as string ?? null,
        active: (body.active as boolean) ?? true,
      },
    });
    return reply.send({ data: webhook });
  });

  fastify.delete('/webhooks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const prisma = getPrisma();
    await prisma.switchWebhookConfig.deleteMany({ where: { id: request.params.id, accountId } });
    return reply.send({ success: true });
  });
}
