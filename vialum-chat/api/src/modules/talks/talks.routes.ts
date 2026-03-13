import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as talksService from './talks.service.js';

// ════════════════════════════════════════════════════════════
// Talk Routes
// ════════════════════════════════════════════════════════════

const createTalkSchema = z.object({
  treeFlowId: z.string().uuid(),
  contactId: z.string().uuid(),
  parentTalkId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const patchTalkSchema = z.object({
  action: z.enum(['pause', 'resume', 'close', 'change_step']),
  reason: z.string().optional(),
  targetStepId: z.string().optional(),
});

export async function talkRoutes(fastify: FastifyInstance) {

  // GET /talks (list all talks for account, optionally filtered by conversationId)
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const query = request.query as {
      conversationId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    if (!query.conversationId) {
      return reply.status(400).send({ error: 'conversationId query param is required', code: 'MISSING_CONVERSATION_ID' });
    }

    const talks = await talksService.listTalks(accountId, query.conversationId, {
      status: query.status,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      offset: query.offset ? parseInt(query.offset, 10) : undefined,
    });

    return reply.send({ data: talks });
  });

  // POST /talks
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const query = request.query as { conversationId?: string };
    const body = createTalkSchema.parse(request.body);

    const conversationId = query.conversationId;
    if (!conversationId) {
      return reply.status(400).send({ error: 'conversationId query param is required', code: 'MISSING_CONVERSATION_ID' });
    }

    try {
      const result = await talksService.createTalk(accountId, {
        conversationId,
        treeFlowId: body.treeFlowId,
        contactId: body.contactId,
        parentTalkId: body.parentTalkId,
        metadata: body.metadata,
      });
      return reply.status(201).send({ data: result });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // GET /talks/:id
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };

    try {
      const talk = await talksService.getTalk(accountId, id);
      return reply.send({ data: talk });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // PATCH /talks/:id
  fastify.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId, userId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const body = patchTalkSchema.parse(request.body);

    try {
      let result: any;

      switch (body.action) {
        case 'pause':
          result = await talksService.pauseTalk(accountId, id, userId);
          break;
        case 'resume':
          result = await talksService.resumeTalk(accountId, id, userId);
          break;
        case 'close':
          result = await talksService.closeTalk(accountId, id, body.reason ?? 'manual', userId);
          break;
        case 'change_step':
          if (!body.targetStepId) {
            return reply.status(400).send({ error: 'targetStepId is required for change_step', code: 'MISSING_STEP_ID' });
          }
          result = await talksService.changeStep(accountId, id, body.targetStepId, userId);
          break;
      }

      return reply.send({ data: result });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });

  // GET /talks/:id/events
  fastify.get('/:id/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { accountId } = request.jwtPayload;
    const { id } = request.params as { id: string };
    const query = request.query as {
      eventType?: string;
      limit?: string;
      offset?: string;
    };

    try {
      const events = await talksService.listEvents(accountId, id, {
        eventType: query.eventType,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return reply.send({ data: events });
    } catch (err: any) {
      if (err.statusCode) {
        return reply.status(err.statusCode).send({ error: err.message, code: err.code });
      }
      throw err;
    }
  });
}
