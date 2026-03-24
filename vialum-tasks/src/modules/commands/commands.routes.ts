import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { sendCommand as sessionSendCommand } from '../../session/session-manager.js';

export async function commandRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  // Send command to a workflow session
  fastify.post('/:workflowId', async (request, reply) => {
    const { accountId, userId } = request.jwtPayload!;
    const { workflowId } = request.params as { workflowId: string };
    const body = request.body as Record<string, unknown>;

    if (!body.command) return reply.status(400).send({ error: 'command required', code: 'BAD_REQUEST' });

    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, accountId, deletedAt: null } });
    if (!workflow) return reply.status(404).send({ error: 'Workflow not found', code: 'NOT_FOUND' });

    const command = await prisma.command.create({
      data: {
        accountId,
        workflowId,
        command: body.command as string,
        sentBy: userId,
      },
    });

    // Send to Claude session (queues if busy, resumes if idle)
    try {
      const result = await sessionSendCommand(workflowId, body.command as string);
      return reply.status(201).send({ data: command, queued: result.queued });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send command';
      return reply.status(201).send({ data: command, sessionError: message });
    }
  });

  // List commands for a workflow
  fastify.get('/:workflowId', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { workflowId } = request.params as { workflowId: string };

    const workflow = await prisma.workflow.findFirst({ where: { id: workflowId, accountId, deletedAt: null } });
    if (!workflow) return reply.status(404).send({ error: 'Workflow not found', code: 'NOT_FOUND' });

    const query = request.query as Record<string, string>;
    const limit = Math.min(parseInt(query.limit ?? '50', 10), 200);

    const commands = await prisma.command.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return { data: commands };
  });
}
