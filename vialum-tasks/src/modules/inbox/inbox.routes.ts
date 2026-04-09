import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';
import { onInboxCompleted, onCheckpointCompleted } from '../../engine/execution-engine.js';
import { tryValidateSchema } from '../../engine/schema-validator.js';
import { broadcastToWorkflow } from '../../plugins/websocket.js';

export async function inboxRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  /**
   * GET /inbox
   * List inbox items filtered by role, status, type.
   * Multi-tenant: accountId from JWT.
   * Multi-operator: filters by assigneeRole or assigneeId.
   */
  fastify.get('/', async (request) => {
    const { accountId, userId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;
    const pag = parsePagination(query);

    const where: Record<string, unknown> = { accountId };

    // Status filter (default: pending)
    where.status = query.status || 'pending';

    // Type filter
    if (query.type) where.type = query.type;

    // Source service filter
    if (query.source_service) where.sourceService = query.source_service;

    // Role filter: items for my role OR assigned to me specifically
    if (query.role) {
      where.OR = [
        { assigneeRole: query.role },
        { assigneeId: userId },
      ];
    }

    // Workflow filter
    if (query.workflowId) where.workflowId = query.workflowId;

    // Exclude dismissed by this user
    where.NOT = { dismissedBy: { has: userId } };

    const [items, total] = await Promise.all([
      prisma.inboxItem.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: pag.skip,
        take: pag.limit,
      }),
      prisma.inboxItem.count({ where }),
    ]);

    return paginatedResponse(items, total, pag);
  });

  /**
   * GET /inbox/count
   * Count pending items for badges.
   */
  fastify.get('/count', async (request) => {
    const { accountId, userId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;

    const where: Record<string, unknown> = {
      accountId,
      status: 'pending',
      NOT: { dismissedBy: { has: userId } },
    };

    if (query.role) {
      where.OR = [
        { assigneeRole: query.role },
        { assigneeId: userId },
      ];
    }

    const count = await prisma.inboxItem.count({ where });
    return { data: { count } };
  });

  /**
   * GET /inbox/:id
   * Detail with input data, output schema, and workflow context.
   */
  fastify.get('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };

    const item = await prisma.inboxItem.findFirst({
      where: { id, accountId },
    });
    if (!item) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    // Enrich with workflow info if linked
    let workflowInfo = null;
    if (item.workflowId) {
      workflowInfo = await prisma.workflow.findUnique({
        where: { id: item.workflowId },
        select: {
          id: true, status: true, stage: true, clientData: true,
          contactPhone: true, externalTaskUrl: true,
          definition: { select: { name: true, slug: true } },
        },
      });
    }

    return { data: { ...item, workflow: workflowInfo } };
  });

  /**
   * POST /inbox/:id/complete
   * Human submits their output for this step.
   * Validates outputData against outputSchema.
   * Triggers engine to advance workflow.
   */
  fastify.post('/:id/complete', async (request, reply) => {
    const { accountId, userId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const item = await prisma.inboxItem.findFirst({
      where: { id, accountId, status: 'pending' },
    });
    if (!item) return reply.status(404).send({ error: 'Not found or already completed', code: 'NOT_FOUND' });

    const outputData = (body.output_data as Record<string, unknown>) || {};

    // Validate against outputSchema if defined
    if (item.outputSchema) {
      const { valid, errors } = tryValidateSchema(
        outputData,
        item.outputSchema as Record<string, unknown>,
      );
      if (!valid) {
        return reply.status(400).send({
          error: `Output validation failed: ${errors.join('; ')}`,
          code: 'VALIDATION_ERROR',
          errors,
        });
      }
    }

    // Route to correct engine handler — fire in background so response is immediate
    const engineFn = item.type === 'checkpoint'
      ? () => onCheckpointCompleted(id, outputData, userId)
      : () => onInboxCompleted(id, outputData, userId);

    // Fire and don't await — engine runs async, UI gets instant response
    engineFn().catch((err) => {
      console.error(`[inbox] Engine error after completing ${id}:`, (err as Error).message);
    });

    const updated = await prisma.inboxItem.findUnique({ where: { id } });
    return { data: updated };
  });

  /**
   * PATCH /inbox/:id/read
   * Mark as read by current user.
   */
  fastify.patch('/:id/read', async (request, reply) => {
    const { accountId, userId } = request.jwtPayload!;
    const { id } = request.params as { id: string };

    const item = await prisma.inboxItem.findFirst({ where: { id, accountId } });
    if (!item) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    if (!item.readBy.includes(userId)) {
      await prisma.inboxItem.update({
        where: { id },
        data: { readBy: { push: userId } },
      });
    }

    return { success: true };
  });

  /**
   * PATCH /inbox/:id/assign
   * Reassign to a specific user or role.
   */
  fastify.patch('/:id/assign', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const item = await prisma.inboxItem.findFirst({ where: { id, accountId } });
    if (!item) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    const data: Record<string, unknown> = {};
    if (body.assignee_id !== undefined) data.assigneeId = body.assignee_id;
    if (body.assignee_role !== undefined) data.assigneeRole = body.assignee_role;

    const updated = await prisma.inboxItem.update({ where: { id }, data });

    broadcastToWorkflow(item.workflowId ?? '', 'inbox:item_assigned', {
      inboxItemId: id,
      assigneeId: updated.assigneeId,
      assigneeRole: updated.assigneeRole,
    });

    return { data: updated };
  });

  /**
   * PATCH /inbox/:id/dismiss
   * Dismiss from inbox (non-destructive — user-specific).
   */
  fastify.patch('/:id/dismiss', async (request, reply) => {
    const { accountId, userId } = request.jwtPayload!;
    const { id } = request.params as { id: string };

    const item = await prisma.inboxItem.findFirst({ where: { id, accountId } });
    if (!item) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });

    if (!item.dismissedBy.includes(userId)) {
      await prisma.inboxItem.update({
        where: { id },
        data: { dismissedBy: { push: userId } },
      });
    }

    return { success: true };
  });
}
