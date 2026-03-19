// ════════════════════════════════════════════════════════════
// Tasks Routes — Agnostic task management endpoints
// Provider-independent: works with ClickUp, Linear, Asana, etc.
// ════════════════════════════════════════════════════════════

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as tasksService from './tasks.service.js';

export async function taskRoutes(fastify: FastifyInstance) {

  // POST / — Create task
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const body = request.body as Record<string, unknown>;

    if (!body.name) {
      return reply.status(400).send({ error: 'name is required', code: 'MISSING_FIELD' });
    }

    try {
      const task = await tasksService.createTask(accountId, {
        name: body.name as string,
        description: body.description as string | undefined,
        status: body.status as string | undefined,
        assignees: body.assignees as string[] | undefined,
        tags: body.tags as string[] | undefined,
        customFields: body.customFields as Array<{ key: string; value: unknown }> | undefined,
        providerParams: body.providerParams as Record<string, unknown> | undefined,
      }, body.caller as string | undefined);

      return reply.status(201).send({ data: task });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /:taskId — Get task
  fastify.get('/:taskId', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;

    try {
      const task = await tasksService.getTask(accountId, taskId);
      if (!task) return reply.status(404).send({ error: 'Task not found', code: 'NOT_FOUND' });
      return reply.send({ data: task });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET / — Search tasks
  fastify.get('/', async (
    request: FastifyRequest<{ Querystring: { search?: string; listId?: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const query = request.query;

    if (!query.search) {
      return reply.status(400).send({ error: 'search query parameter is required', code: 'MISSING_FIELD' });
    }

    try {
      const tasks = await tasksService.searchTasks(accountId, query.search, query.listId);
      return reply.send({ data: tasks });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // PUT /:taskId — Update task
  fastify.put('/:taskId', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    try {
      const task = await tasksService.updateTask(accountId, taskId, {
        name: body.name as string | undefined,
        description: body.description as string | undefined,
        status: body.status as string | undefined,
        assignees: body.assignees as UpdateTaskParams['assignees'],
        tags: body.tags as UpdateTaskParams['tags'],
      }, body.caller as string | undefined);

      return reply.send({ data: task });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // PUT /:taskId/status — Update status only
  fastify.put('/:taskId/status', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    if (!body.status) {
      return reply.status(400).send({ error: 'status is required', code: 'MISSING_FIELD' });
    }

    try {
      const task = await tasksService.updateStatus(accountId, taskId, body.status as string, body.caller as string | undefined);
      return reply.send({ data: task });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // POST /:taskId/comments — Add comment
  fastify.post('/:taskId/comments', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    if (!body.text) {
      return reply.status(400).send({ error: 'text is required', code: 'MISSING_FIELD' });
    }

    try {
      await tasksService.addComment(accountId, taskId, body.text as string, body.caller as string | undefined);
      return reply.status(201).send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // POST /:taskId/attachments — Add attachment
  fastify.post('/:taskId/attachments', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    if (!body.fileUrl || !body.filename) {
      return reply.status(400).send({ error: 'fileUrl and filename are required', code: 'MISSING_FIELD' });
    }

    try {
      await tasksService.addAttachment(accountId, taskId, body.fileUrl as string, body.filename as string, body.caller as string | undefined);
      return reply.status(201).send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // PUT /:taskId/fields/:fieldKey — Set custom field
  fastify.put('/:taskId/fields/:fieldKey', async (
    request: FastifyRequest<{ Params: { taskId: string; fieldKey: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const { taskId, fieldKey } = request.params;
    const body = request.body as Record<string, unknown>;

    if (body.value === undefined) {
      return reply.status(400).send({ error: 'value is required', code: 'MISSING_FIELD' });
    }

    try {
      await tasksService.setField(accountId, taskId, fieldKey, body.value, body.caller as string | undefined);
      return reply.send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // PUT /:taskId/assignees — Set assignees
  fastify.put('/:taskId/assignees', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    if (!body.assignees || !Array.isArray(body.assignees)) {
      return reply.status(400).send({ error: 'assignees array is required', code: 'MISSING_FIELD' });
    }

    try {
      await tasksService.setAssignees(accountId, taskId, body.assignees as string[], body.caller as string | undefined);
      return reply.send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // POST /:taskId/tags — Add tag
  fastify.post('/:taskId/tags', async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;
    const { taskId } = request.params;
    const body = request.body as Record<string, unknown>;

    if (!body.tag) {
      return reply.status(400).send({ error: 'tag is required', code: 'MISSING_FIELD' });
    }

    try {
      await tasksService.addTag(accountId, taskId, body.tag as string, body.caller as string | undefined);
      return reply.status(201).send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // DELETE /:taskId/tags/:tag — Remove tag
  fastify.delete('/:taskId/tags/:tag', async (
    request: FastifyRequest<{ Params: { taskId: string; tag: string } }>,
    reply: FastifyReply,
  ) => {
    const { accountId } = request.jwtPayload!;
    const { taskId, tag } = request.params;

    try {
      await tasksService.removeTag(accountId, taskId, tag);
      return reply.send({ success: true });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });

  // GET /members — List workspace members
  fastify.get('/members', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload!;

    try {
      const members = await tasksService.getMembers(accountId);
      return reply.send({ data: members });
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e.statusCode) return reply.status(e.statusCode as number).send({ error: e.message, code: e.code });
      throw err;
    }
  });
}

// Type import for route body typing
import type { UpdateTaskParams } from '../../providers/task-provider.interface.js';
