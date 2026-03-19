import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as treeFlowService from './treeflow.service.js';

// ════════════════════════════════════════════════════════════
// TreeFlow Routes
// ════════════════════════════════════════════════════════════

const actionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['text', 'number', 'boolean', 'date', 'email', 'phone', 'select', 'multi_select', 'url', 'custom']),
  required: z.boolean(),
  validation: z.object({
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    min_length: z.number().optional(),
    max_length: z.number().optional(),
    options: z.array(z.string()).optional(),
    custom_message: z.string().optional(),
  }).nullable().optional(),
  extraction_hint: z.string(),
});

const transitionConditionSchema = z.object({
  type: z.enum(['all_actions_filled', 'specific_actions_filled', 'message_count_exceeded', 'objection_detected', 'escape_detected', 'manual', 'always', 'custom']),
  params: z.record(z.unknown()).default({}),
});

const transitionSchema = z.object({
  id: z.string().min(1),
  target_step_id: z.string().min(1),
  condition: transitionConditionSchema,
  priority: z.number().int().default(0),
});

const stepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(['opening', 'qualification', 'presentation', 'negotiation', 'closing', 'fallback', 'custom']),
  instructions: z.string(),
  actions: z.array(actionSchema).default([]),
  transitions: z.array(transitionSchema).default([]),
  max_messages_in_step: z.number().int().default(20),
  labels_to_apply: z.array(z.string()).default([]),
  sub_treeflow_slug: z.string().nullable().default(null),
});

const definitionSchema = z.object({
  initial_step_id: z.string().min(1),
  steps: z.array(stepSchema).min(1),
  global_instructions: z.string().default(''),
});

const settingsSchema = z.object({
  auto_mode_enabled: z.boolean().optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
  inactivity_timeout_minutes: z.number().int().min(1).optional(),
  max_objection_retries: z.number().int().min(0).optional(),
  default_labels: z.array(z.string()).optional(),
}).optional();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  category: z.string().optional(),
  settings: settingsSchema,
  definition: definitionSchema.optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  settings: settingsSchema,
  isArchived: z.boolean().optional(),
});

const createVersionSchema = z.object({
  definition: definitionSchema,
  notes: z.string().optional(),
});

export async function treeFlowRoutes(fastify: FastifyInstance) {

  // GET /tree-flows
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const query = request.query as { includeArchived?: string };
    const includeArchived = query.includeArchived === 'true';

    const treeFlows = await treeFlowService.listTreeFlows(accountId, { includeArchived });
    return reply.send({ data: treeFlows });
  });

  // POST /tree-flows — admin only
  fastify.post('/', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const body = createSchema.parse(request.body);

    try {
      const result = await treeFlowService.createTreeFlow(accountId, body as any);
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // GET /tree-flows/:id
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    try {
      const treeFlow = await treeFlowService.getTreeFlow(accountId, id);
      return reply.send({ data: treeFlow });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // PATCH /tree-flows/:id — admin only
  fastify.patch('/:id', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);

    try {
      const treeFlow = await treeFlowService.updateTreeFlow(accountId, id, body);
      return reply.send({ data: treeFlow });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /tree-flows/:id/versions — admin only
  fastify.post('/:id/versions', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = createVersionSchema.parse(request.body);

    try {
      const version = await treeFlowService.createVersion(accountId, id, body as any);
      return reply.status(201).send({ data: version });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /tree-flows/:id/versions/:versionId/publish — admin only
  fastify.post('/:id/versions/:versionId/publish', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id, versionId } = request.params as { id: string; versionId: string };

    try {
      const version = await treeFlowService.publishVersion(accountId, id, versionId);
      return reply.send({ data: version });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
