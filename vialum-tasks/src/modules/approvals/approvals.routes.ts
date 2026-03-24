import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { parsePagination, paginatedResponse } from '../../lib/pagination.js';

export async function approvalRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  // List approvals for account
  fastify.get('/', async (request) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;
    const pag = parsePagination(query);
    const where: Record<string, unknown> = { accountId };
    if (query.status) where.status = query.status;

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        include: {
          workflow: {
            select: { id: true, clientData: true, stage: true, definition: { select: { name: true, slug: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: pag.skip,
        take: pag.limit,
      }),
      prisma.approval.count({ where }),
    ]);
    return paginatedResponse(approvals, total, pag);
  });

  // Get single approval — tenant-checked
  fastify.get('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const approval = await prisma.approval.findFirst({ where: { id, accountId } });
    if (!approval) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
    return { data: approval };
  });

  // Create approval (from MCP server or internal). Uses service auth via parent JWT scope.
  fastify.post('/', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    const workflowId = body.workflow_id as string;
    if (!workflowId) return reply.status(400).send({ error: 'workflow_id required', code: 'BAD_REQUEST' });

    // Verify workflow belongs to tenant
    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, accountId } });
    if (!workflow) return reply.status(404).send({ error: 'Workflow not found', code: 'NOT_FOUND' });

    // Idempotency: only one pending approval per workflow+step
    const step = body.step as string;
    const existing = await prisma.approval.findFirst({
      where: { workflowId, step, status: 'pending' },
    });
    if (existing) return reply.status(200).send({ data: existing });

    const approval = await prisma.approval.create({
      data: {
        accountId,
        workflowId,
        step,
        title: body.title as string,
        description: (body.description as string) || null,
        attachments: (body.attachments as object) || [],
        formSchema: (body.form_schema as object) || null,
      },
    });

    // Mark workflow as waiting for HITL
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'hitl' },
    });

    // TODO (Story 2): Broadcast via Socket.IO

    return reply.status(201).send({ data: approval });
  });

  // Decide approval (approve/reject) — with optimistic locking
  fastify.patch('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    // Optimistic lock: only update if still pending
    const result = await prisma.approval.updateMany({
      where: { id, accountId, status: 'pending' },
      data: {
        status: body.status as string,
        decidedBy: (body.decided_by as string) || request.jwtPayload?.userId || null,
        reason: (body.reason as string) || null,
        formData: (body.form_data as object) || null,
        decidedAt: new Date(),
      },
    });

    if (result.count === 0) {
      const exists = await prisma.approval.findFirst({ where: { id, accountId } });
      if (!exists) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
      return reply.status(409).send({ error: 'Already decided', code: 'CONFLICT' });
    }

    const updated = await prisma.approval.findUnique({ where: { id } });

    // Check if workflow has more pending approvals; if not, resume
    const pendingCount = await prisma.approval.count({
      where: { workflowId: updated!.workflowId, status: 'pending' },
    });
    if (pendingCount === 0) {
      await prisma.workflow.update({
        where: { id: updated!.workflowId },
        data: { status: 'running' },
      });
    }

    // TODO (Story 2): Broadcast via Socket.IO

    return { data: updated };
  });
}
