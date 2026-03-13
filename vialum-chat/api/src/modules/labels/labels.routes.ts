import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as labelsService from './labels.service.js';

const createLabelSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().nullish(),
});

const updateLabelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  description: z.string().nullish(),
});

type AccountParams = { accountId: string };
type LabelParams = { accountId: string; labelId: string };

export async function labelRoutes(fastify: FastifyInstance) {
  // GET /
  fastify.get('/', async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const labels = await labelsService.findAll(accountId);
    return reply.status(200).send({ data: labels });
  });

  // GET /:labelId
  fastify.get('/:labelId', async (request: FastifyRequest<{ Params: LabelParams }>, reply: FastifyReply) => {
    const { accountId, labelId } = request.params;
    try {
      const label = await labelsService.findById(accountId, labelId);
      return reply.status(200).send({ data: label });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /
  fastify.post('/', async (request: FastifyRequest<{ Params: AccountParams }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createLabelSchema.parse(request.body);
    const label = await labelsService.create(accountId, body);
    return reply.status(201).send({ data: label });
  });

  // PUT /:labelId
  fastify.put('/:labelId', async (request: FastifyRequest<{ Params: LabelParams }>, reply: FastifyReply) => {
    const { accountId, labelId } = request.params;
    const body = updateLabelSchema.parse(request.body);
    try {
      const label = await labelsService.update(accountId, labelId, body);
      return reply.status(200).send({ data: label });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:labelId
  fastify.delete('/:labelId', async (request: FastifyRequest<{ Params: LabelParams }>, reply: FastifyReply) => {
    const { accountId, labelId } = request.params;
    try {
      await labelsService.remove(accountId, labelId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
