import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';

export async function stepRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  /**
   * GET /workflows/:workflowId/steps
   * Full hierarchy: Stage > Task > Step with status
   */
  fastify.get('/:workflowId/steps', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { workflowId } = request.params as { workflowId: string };

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, accountId, deletedAt: null },
    });
    if (!workflow) return reply.status(404).send({ error: 'Workflow not found', code: 'NOT_FOUND' });

    const stages = await prisma.workflowStage.findMany({
      where: { workflowId },
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          orderBy: { position: 'asc' },
          include: {
            steps: {
              orderBy: { position: 'asc' },
              select: {
                id: true,
                definitionStepId: true,
                name: true,
                position: true,
                executor: true,
                adapterType: true,
                status: true,
                assigneeRole: true,
                isGate: true,
                output: true,
                errorMessage: true,
                retryCount: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });

    return { data: stages };
  });

  /**
   * GET /workflows/:workflowId/steps/:stepId
   * Step detail with executions
   */
  fastify.get('/:workflowId/steps/:stepId', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { workflowId, stepId } = request.params as { workflowId: string; stepId: string };

    const step = await prisma.workflowStep.findFirst({
      where: { id: stepId, workflowId, accountId },
      include: {
        executions: { orderBy: { createdAt: 'desc' }, take: 20 },
        task: { select: { id: true, name: true, stage: { select: { id: true, name: true } } } },
      },
    });
    if (!step) return reply.status(404).send({ error: 'Step not found', code: 'NOT_FOUND' });

    return { data: step };
  });

  /**
   * GET /workflows/:workflowId/context
   * Current context bus snapshot
   */
  fastify.get('/:workflowId/context', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { workflowId } = request.params as { workflowId: string };

    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, accountId, deletedAt: null },
      select: { context: true },
    });
    if (!workflow) return reply.status(404).send({ error: 'Workflow not found', code: 'NOT_FOUND' });

    return { data: workflow.context };
  });
}
