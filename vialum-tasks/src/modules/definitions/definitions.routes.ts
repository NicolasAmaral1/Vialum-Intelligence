import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { parseDefinitionYaml } from '../../engine/definition-parser.js';

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

    // v2 definition (YAML)
    if (body.definition_format === 'v2') {
      const yamlStr = body.definition_yaml as string;
      if (!yamlStr) {
        return reply.status(400).send({ error: 'definition_yaml is required for v2 format', code: 'INVALID_INPUT' });
      }

      // Validate YAML parses correctly
      let parsed;
      try {
        parsed = parseDefinitionYaml(yamlStr);
      } catch (err) {
        return reply.status(400).send({ error: `Invalid YAML: ${(err as Error).message}`, code: 'INVALID_YAML' });
      }

      const definition = await prisma.workflowDefinition.create({
        data: {
          accountId,
          slug: parsed.slug,
          name: parsed.name,
          description: parsed.description || null,
          stages: {},  // legacy field — not used for v2
          definitionFormat: 'v2',
          definitionYaml: yamlStr,
          version: parsed.version,
          dataSchema: (parsed.dataSchema as object) || {},
        },
      });
      return reply.status(201).send({ data: definition });
    }

    // Legacy definition (JSON)
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

    // v2: update YAML (re-validates)
    if (body.definition_yaml !== undefined) {
      const yamlStr = body.definition_yaml as string;
      try {
        const parsed = parseDefinitionYaml(yamlStr);
        data.definitionYaml = yamlStr;
        data.definitionFormat = 'v2';
        data.name = parsed.name;
        data.description = parsed.description;
        data.version = (existing.version ?? 0) + 1;
        data.dataSchema = parsed.dataSchema || {};
      } catch (err) {
        return reply.status(400).send({ error: `Invalid YAML: ${(err as Error).message}`, code: 'INVALID_YAML' });
      }
    }

    // Legacy + shared fields
    if (body.name !== undefined && !data.name) data.name = body.name;
    if (body.description !== undefined && !data.description) data.description = body.description;
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
