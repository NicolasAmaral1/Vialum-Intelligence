import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { startSession, stopSession } from '../../session/session-manager.js';
import * as engine from '../../engine/execution-engine.js';

export async function workflowRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  fastify.get('/', async (request) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;
    const pag = parsePagination(query);
    const where: Record<string, unknown> = { accountId, deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.stage) where.stage = query.stage;
    if (query.definition_slug) where.definition = { slug: query.definition_slug };

    const [workflows, total] = await Promise.all([
      prisma.workflow.findMany({
        where,
        include: { definition: { select: { name: true, slug: true, squad: true, stages: true, commands: true } } },
        orderBy: { updatedAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
      }),
      prisma.workflow.count({ where }),
    ]);
    return paginatedResponse(workflows, total, pag);
  });

  fastify.post('/', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    // Idempotency: if key provided, check for existing workflow
    const idempotencyKey = body.idempotency_key as string | undefined;
    if (idempotencyKey) {
      const existing = await prisma.workflow.findUnique({ where: { idempotencyKey } });
      if (existing) return reply.status(200).send({ data: existing });
    }

    const definition = await prisma.workflowDefinition.findFirst({
      where: { id: body.definition_id as string, accountId },
    });
    if (!definition) return reply.status(404).send({ error: 'Definition not found', code: 'NOT_FOUND' });

    // ═══ V2 PATH: new engine ═══
    if (definition.definitionFormat === 'v2') {
      try {
        const workflow = await engine.createWorkflow({
          definitionId: definition.id,
          accountId,
          clientData: (body.client_data as Record<string, unknown>) || {},
          contactPhone: (body.contact_phone as string) || undefined,
          conversationId: (body.conversation_id as string) || undefined,
          hubContactId: (body.hub_contact_id as string) || undefined,
          idempotencyKey: idempotencyKey || undefined,
        });

        // Auto-start unless explicitly told not to
        if (body.auto_start !== false) {
          await engine.startWorkflow(workflow.id);
        }

        const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
        return reply.status(201).send({ data: updated });
      } catch (err) {
        const message = (err as Error).message;
        const status = message.includes('already exists') ? 409 : 400;
        return reply.status(status).send({ error: message, code: 'ENGINE_ERROR' });
      }
    }

    // ═══ LEGACY PATH: old session manager ═══
    const stages = definition.stages as Array<{ id: string; position: number }>;
    const firstStage = [...stages].sort((a, b) => a.position - b.position)[0];

    const workflow = await prisma.workflow.create({
      data: {
        accountId,
        definitionId: definition.id,
        idempotencyKey: idempotencyKey || null,
        stage: firstStage?.id ?? 'initial',
        status: 'idle',
        clientData: (body.client_data as object) || {},
        context: {},
        contactPhone: (body.contact_phone as string) || null,
        conversationId: (body.conversation_id as string) || null,
        externalTaskId: (body.external_task_id as string) || null,
        externalTaskUrl: (body.external_task_url as string) || null,
        hubContactId: (body.hub_contact_id as string) || null,
      },
    });

    const prompt = body.prompt as string | undefined;
    const autoPrompt = prompt || renderPrompt(definition.promptTemplate, body.client_data as Record<string, unknown> | undefined);

    if (autoPrompt) {
      try {
        await startSession({
          workflowId: workflow.id,
          accountId,
          prompt: autoPrompt,
          cwd: definition.cwd || undefined,
        });
      } catch (err) {
        fastify.log.error({ err, workflowId: workflow.id }, 'Failed to auto-start session');
      }
    }

    const updated = await prisma.workflow.findUnique({ where: { id: workflow.id } });
    return reply.status(201).send({ data: updated });
  });

  fastify.get('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const workflow = await prisma.workflow.findFirst({
      where: { id, accountId, deletedAt: null },
      include: {
        definition: true,
        approvals: { where: { status: 'pending' }, orderBy: { createdAt: 'desc' } },
        // v2: include full hierarchy
        wfStages: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                steps: { orderBy: { position: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!workflow) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
    return { data: workflow };
  });

  // Get events for a workflow
  fastify.get('/:id/events', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;
    const limit = Math.min(parseInt(query.limit ?? '100', 10), 500);

    const workflow = await prisma.workflow.findFirst({ where: { id, accountId, deletedAt: null } });
    if (!workflow) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    const events = await prisma.workflowEvent.findMany({
      where: { workflowId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { data: events };
  });

  fastify.patch('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await prisma.workflow.findFirst({ where: { id, accountId, deletedAt: null } });
    if (!existing) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
    const data: Record<string, unknown> = {};
    if (body.stage !== undefined) data.stage = body.stage;
    if (body.status !== undefined) data.status = body.status;
    if (body.client_data !== undefined) data.clientData = body.client_data;
    if (body.context !== undefined) data.context = body.context;
    if (body.session_id !== undefined) data.sessionId = body.session_id;
    if (body.error_message !== undefined) data.errorMessage = body.error_message;
    const updated = await prisma.workflow.update({ where: { id }, data });
    return { data: updated };
  });

  // Soft delete
  fastify.delete('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const existing = await prisma.workflow.findFirst({ where: { id, accountId, deletedAt: null } });
    if (!existing) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    // Stop Claude session if running
    await stopSession(id).catch(() => {});

    await prisma.workflow.update({ where: { id }, data: { deletedAt: new Date(), status: 'cancelled' } });
    return { success: true };
  });
}

/**
 * Render a prompt template by replacing {{key}} with values from clientData.
 * Returns null if no template provided.
 */
function renderPrompt(template: string | null, data?: Record<string, unknown> | null): string | null {
  if (!template) return null;
  if (!data) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  });
}
