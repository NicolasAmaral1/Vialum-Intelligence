import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getProvider } from '../../providers/provider.registry.js';
import { ClickUpProvider } from '../../providers/clickup/clickup.provider.js';
import * as integrationsService from '../integrations/integrations.service.js';

export async function clickupRoutes(fastify: FastifyInstance) {
  // GET /search?name=X&listId=Y — search tasks
  fastify.get('/search', async (
    request: FastifyRequest<{ Querystring: { name?: string; listId?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query as Record<string, string>;

    if (!query.name) {
      return reply.status(400).send({ error: 'name query parameter is required', code: 'MISSING_FIELD' });
    }

    try {
      const provider = getProvider('clickup') as ClickUpProvider;
      const tasks = await provider.searchTasks(accountId, query.name, query.listId);
      return reply.send({ data: { tasks } });
    } catch (err: any) {
      if (err.statusCode) return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      throw err;
    }
  });

  // POST /link — link a task to a vialum contact
  fastify.post('/link', async (
    request: FastifyRequest<{
      Body: { vialumContactId: string; taskId: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.vialumContactId || !body.taskId) {
      return reply.status(400).send({ error: 'vialumContactId and taskId are required', code: 'MISSING_FIELD' });
    }

    const provider = getProvider('clickup') as ClickUpProvider;
    const task = await provider.getTask(accountId, body.taskId as string);

    const integration = await integrationsService.create(accountId, body.vialumContactId as string, {
      provider: 'clickup',
      externalId: body.taskId as string,
      externalUrl: task?.url ?? `https://app.clickup.com/t/${body.taskId}`,
      resourceType: 'task',
      resourceName: task?.name ?? undefined,
      status: task?.status?.status ?? undefined,
      rawData: task as unknown as Record<string, unknown> ?? {},
    });

    return reply.status(201).send({ data: integration });
  });
}
