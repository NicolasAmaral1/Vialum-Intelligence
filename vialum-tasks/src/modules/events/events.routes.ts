import { FastifyInstance } from 'fastify';
import { getPrisma } from '../../config/database.js';
import { env } from '../../config/env.js';

export async function eventRoutes(fastify: FastifyInstance) {
  const prisma = getPrisma();

  // Hook event receiver (no JWT — auth via webhook secret)
  fastify.post('/events/hook', async (request, reply) => {
    const secret = request.headers['x-webhook-secret'];
    if (secret !== env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Invalid webhook secret', code: 'UNAUTHORIZED' });
    }

    const body = request.body as Record<string, unknown>;
    const sessionId = body.session_id as string;
    if (!sessionId) return reply.status(400).send({ error: 'session_id required', code: 'BAD_REQUEST' });

    const workflow = await prisma.workflow.findFirst({ where: { sessionId } });
    if (!workflow) {
      return reply.status(202).send({ ok: true, matched: false });
    }

    await prisma.workflowEvent.create({
      data: {
        accountId: workflow.accountId,
        workflowId: workflow.id,
        eventType: (body.event_type as string) || 'hook',
        toolName: (body.tool_name as string) || null,
        payload: (body.payload as object) || null,
      },
    });

    return { ok: true, matched: true };
  });

  // Chat webhook receiver (no JWT — auth via webhook secret)
  // Chat sends events when messages arrive from WhatsApp
  fastify.post('/events/chat', async (request, reply) => {
    const secret = request.headers['x-webhook-secret'];
    if (secret !== env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Invalid webhook secret', code: 'UNAUTHORIZED' });
    }

    const body = request.body as Record<string, unknown>;
    const event = body.event as string;

    // Only process incoming messages (client replied)
    if (event !== 'message.created') {
      return reply.status(202).send({ ok: true, skipped: true });
    }

    const data = body.data as Record<string, unknown> | undefined;
    if (!data) return reply.status(400).send({ error: 'data required', code: 'BAD_REQUEST' });

    const messageType = data.messageType as string;
    if (messageType !== 'incoming') {
      return reply.status(202).send({ ok: true, skipped: true });
    }

    const conversationId = data.conversationId as string;
    const contactPhone = data.contactPhone as string;
    const accountId = body.accountId as string;

    // Find workflow by conversationId first, fallback to contactPhone
    let workflow = conversationId
      ? await prisma.workflow.findFirst({
          where: { conversationId, accountId, deletedAt: null, status: { not: 'completed' } },
        })
      : null;

    if (!workflow && contactPhone) {
      workflow = await prisma.workflow.findFirst({
        where: { contactPhone, accountId, deletedAt: null, status: { not: 'completed' } },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!workflow) {
      return reply.status(202).send({ ok: true, matched: false });
    }

    // Save event
    await prisma.workflowEvent.create({
      data: {
        accountId: workflow.accountId,
        workflowId: workflow.id,
        eventType: 'chat.message_received',
        payload: {
          conversationId,
          contactPhone,
          content: String(data.content ?? ''),
          contentType: String(data.contentType ?? 'text'),
          messageId: String(data.messageId ?? ''),
        },
      },
    });

    // If workflow is paused/waiting, it can be resumed
    // TODO (Story 2): Session Manager — resume with message context
    // The session would be resumed with: "O cliente respondeu: {content}"

    // TODO: Broadcast via Socket.IO
    return { ok: true, matched: true, workflowId: workflow.id };
  });

  // Hub webhook receiver (no JWT — auth via webhook secret)
  // Hub sends events when external tasks change (ClickUp status changed, etc.)
  fastify.post('/events/hub', async (request, reply) => {
    const secret = request.headers['x-webhook-secret'];
    if (secret !== env.WEBHOOK_SECRET) {
      return reply.status(401).send({ error: 'Invalid webhook secret', code: 'UNAUTHORIZED' });
    }

    const body = request.body as Record<string, unknown>;
    const event = body.event as string;
    const data = body.data as Record<string, unknown> | undefined;
    if (!data) return reply.status(400).send({ error: 'data required', code: 'BAD_REQUEST' });

    const externalTaskId = data.taskId as string;
    const accountId = body.accountId as string;

    if (!externalTaskId) {
      return reply.status(202).send({ ok: true, skipped: true });
    }

    const workflow = await prisma.workflow.findFirst({
      where: { externalTaskId, accountId, deletedAt: null },
    });

    if (!workflow) {
      return reply.status(202).send({ ok: true, matched: false });
    }

    await prisma.workflowEvent.create({
      data: {
        accountId: workflow.accountId,
        workflowId: workflow.id,
        eventType: `hub.${event}`,
        payload: data as object,
      },
    });

    return { ok: true, matched: true, workflowId: workflow.id };
  });
}
