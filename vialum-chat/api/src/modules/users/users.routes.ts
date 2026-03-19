import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as usersService from './users.service.js';

const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['agent', 'admin']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['agent', 'admin']).optional(),
  availability: z.enum(['online', 'offline', 'busy']).optional(),
});

export async function userRoutes(fastify: FastifyInstance) {
  // GET / — list all users (any authenticated user)
  fastify.get('/', async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const users = await usersService.list(accountId);
    return reply.status(200).send({ data: users });
  });

  // POST / — create user (admin only)
  fastify.post('/', {
    onRequest: [(fastify as any).adminGuard],
  }, async (request: FastifyRequest<{ Params: { accountId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.params;
    const body = createUserSchema.parse(request.body);
    try {
      const user = await usersService.create(accountId, body);
      return reply.status(201).send({ data: user });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // PUT /:userId — update user (admin only)
  fastify.put('/:userId', {
    onRequest: [(fastify as any).adminGuard],
  }, async (request: FastifyRequest<{ Params: { accountId: string; userId: string } }>, reply: FastifyReply) => {
    const { accountId, userId } = request.params;
    const body = updateUserSchema.parse(request.body);
    try {
      const user = await usersService.update(accountId, userId, body);
      return reply.status(200).send({ data: user });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // DELETE /:userId — remove user from account (admin only)
  fastify.delete('/:userId', {
    onRequest: [(fastify as any).adminGuard],
  }, async (request: FastifyRequest<{ Params: { accountId: string; userId: string } }>, reply: FastifyReply) => {
    const { accountId, userId } = request.params;
    try {
      await usersService.remove(accountId, userId);
      return reply.status(204).send();
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });
}
