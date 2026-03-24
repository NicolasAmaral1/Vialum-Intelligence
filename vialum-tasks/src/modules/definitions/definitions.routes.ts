import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';

export async function definitionRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  fastify.get('/', async (request) => {
    const { accountId } = request.jwtPayload!;
    const definitions = await prisma.workflowDefinition.findMany({
      where: { accountId, active: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: definitions };
  });

  fastify.post('/', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;
    const definition = await prisma.workflowDefinition.create({
      data: {
        accountId,
        slug: body.slug as string,
        name: body.name as string,
        description: (body.description as string) || null,
        squad: (body.squad as string) || null,
        stages: body.stages as object,
        commands: (body.commands as object) || [],
        dataSchema: (body.data_schema as object) || {},
        hitlSteps: (body.hitl_steps as object) || [],
        promptTemplate: (body.prompt_template as string) || null,
        cwd: (body.cwd as string) || null,
      },
    });
    return reply.status(201).send({ data: definition });
  });

  fastify.get('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const definition = await prisma.workflowDefinition.findFirst({
      where: { id, accountId },
    });
    if (!definition) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
    return { data: definition };
  });

  fastify.patch('/:id', async (request, reply) => {
    const { accountId } = request.jwtPayload!;
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;
    const existing = await prisma.workflowDefinition.findFirst({ where: { id, accountId } });
    if (!existing) return reply.status(404).send({ error: 'Not found', code: 'NOT_FOUND' });
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.squad !== undefined) data.squad = body.squad;
    if (body.stages !== undefined) data.stages = body.stages;
    if (body.commands !== undefined) data.commands = body.commands;
    if (body.data_schema !== undefined) data.dataSchema = body.data_schema;
    if (body.hitl_steps !== undefined) data.hitlSteps = body.hitl_steps;
    if (body.prompt_template !== undefined) data.promptTemplate = body.prompt_template;
    if (body.cwd !== undefined) data.cwd = body.cwd;
    if (body.active !== undefined) data.active = body.active;
    const updated = await prisma.workflowDefinition.update({ where: { id }, data });
    return { data: updated };
  });
}
