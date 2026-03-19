import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as automationService from './automation.service.js';

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  eventName: z.string().min(1).max(100),
  conditions: z.array(z.unknown()).optional(),
  actions: z.array(z.unknown()).optional(),
  active: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullish(),
  eventName: z.string().min(1).max(100).optional(),
  conditions: z.array(z.unknown()).optional(),
  actions: z.array(z.unknown()).optional(),
});

type AccountParams = { accountId: string };
type RuleParams = { accountId: string; ruleId: string };

export async function automationRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const data = await automationService.findAll(accountId);
    return reply.status(200).send({ data });
  });

  // GET /:ruleId
  fastify.get('/:ruleId', async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
    const { accountId, ruleId } = request.params;
    try {
      const data = await automationService.findById(accountId, ruleId);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST / — admin only
  fastify.post('/', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createSchema.parse(request.body);
    const data = await automationService.create(accountId, body);
    return reply.status(201).send({ data });
  });

  // PUT /:ruleId — admin only
  fastify.put('/:ruleId', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
    const { accountId, ruleId } = request.params;
    const body = updateSchema.parse(request.body);
    try {
      const data = await automationService.update(accountId, ruleId, body);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /:ruleId/toggle — admin only
  fastify.post('/:ruleId/toggle', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
    const { accountId, ruleId } = request.params;
    try {
      const data = await automationService.toggleActive(accountId, ruleId);
      return reply.status(200).send({ data });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:ruleId — admin only
  fastify.delete('/:ruleId', { onRequest: [(fastify as any).adminGuard] }, async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
    const { accountId, ruleId } = request.params;
    try {
      await automationService.remove(accountId, ruleId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
