import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as objectionsService from './objections.service.js';

// ════════════════════════════════════════════════════════════
// Objections Routes
// ════════════════════════════════════════════════════════════

const treeFlowLinkSchema = z.object({
  treeFlowId: z.string().uuid(),
  stepIds: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['price', 'timing', 'trust', 'competitor', 'custom']).optional(),
  description: z.string().optional(),
  detectionHints: z.array(z.string()).optional(),
  rebuttalStrategy: z.string().optional(),
  rebuttalExamples: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  treeFlowIds: z.array(treeFlowLinkSchema).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(['price', 'timing', 'trust', 'competitor', 'custom']).optional(),
  description: z.string().optional(),
  detectionHints: z.array(z.string()).optional(),
  rebuttalStrategy: z.string().optional(),
  rebuttalExamples: z.array(z.string()).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  treeFlowIds: z.array(treeFlowLinkSchema).optional(),
});

export async function objectionRoutes(fastify: FastifyInstance) {

  // GET /objections
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const query = request.query as { category?: string; limit?: string; offset?: string };

    const objections = await objectionsService.listObjections(accountId, {
      category: query.category,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.send({ data: objections });
  });

  // GET /objections/:id
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    try {
      const objection = await objectionsService.getObjection(accountId, id);
      return reply.send({ data: objection });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // POST /objections
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const body = createSchema.parse(request.body);

    try {
      const objection = await objectionsService.createObjection(accountId, body);
      return reply.status(201).send({ data: objection });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // PATCH /objections/:id
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);

    try {
      const objection = await objectionsService.updateObjection(accountId, id, body);
      return reply.send({ data: objection });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // DELETE /objections/:id
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    try {
      await objectionsService.deleteObjection(accountId, id);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
