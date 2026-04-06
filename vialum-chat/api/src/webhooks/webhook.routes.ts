import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPrisma } from '../config/database.js';
import { Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import crypto from 'node:crypto';

let incomingMessageQueue: Queue | null = null;

function getIncomingMessageQueue(): Queue {
  if (!incomingMessageQueue) {
    incomingMessageQueue = new Queue('webhook-process', {
      connection: getRedis() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return incomingMessageQueue;
}

export async function webhookRoutes(fastify: FastifyInstance) {

  // Rate limit per inboxId: 100 requests/minute
  const webhookRateLimit = {
    config: {
      rateLimit: {
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) =>
          `webhook:${(request.params as Record<string, string>).inboxId}`,
      },
    },
  };

  // ──────────────────────────────────────────────────────────
  // Evolution API Webhook
  // ──────────────────────────────────────────────────────────

  fastify.post('/evolution/:inboxId', webhookRateLimit, async (
    request: FastifyRequest<{ Params: { inboxId: string }; Body: Record<string, unknown> }>,
    reply: FastifyReply,
  ) => {
    const { inboxId } = request.params;
    const payload = request.body as Record<string, unknown>;
    const prisma = getPrisma();

    // Validate inbox exists
    const inbox = await prisma.inbox.findUnique({
      where: { id: inboxId },
      select: { id: true, accountId: true, provider: true },
    });

    if (!inbox || inbox.provider !== 'evolution_api') {
      return reply.status(404).send({ error: 'Inbox not found or wrong provider' });
    }

    // Build idempotency key from Evolution event data
    const eventType = (payload.event as string) ?? 'unknown';
    const messageData = payload.data as Record<string, unknown> | undefined;
    const externalId = (messageData?.key as Record<string, unknown>)?.id as string
      ?? (messageData?.id as string)
      ?? crypto.randomUUID();
    const idempotencyKey = `evo:${inboxId}:${externalId}`;

    // Check idempotency
    const existing = await prisma.webhookEvent.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return reply.status(200).send({ status: 'duplicate', eventId: existing.id });
    }

    // Store webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        accountId: inbox.accountId,
        inboxId,
        provider: 'evolution_api',
        eventType,
        idempotencyKey,
        payload: payload as any,
      },
    });

    // Filter relevant events: only process message events
    const messageEvents = [
      'messages.upsert',
      'messages.update',
      'message.status',
      'send.message',
    ];

    if (messageEvents.includes(eventType)) {
      await getIncomingMessageQueue().add('process', {
        webhookEventId: webhookEvent.id,
        inboxId,
        accountId: inbox.accountId,
        provider: 'evolution_api',
        eventType,
        payload,
      });
    }

    // Mark as processed for non-message events
    if (!messageEvents.includes(eventType)) {
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processed: true },
      });
    }

    return reply.status(200).send({ status: 'received', eventId: webhookEvent.id });
  });

  // ──────────────────────────────────────────────────────────
  // WhatsApp Cloud API Webhook — Verification (GET)
  // ──────────────────────────────────────────────────────────

  fastify.get('/cloud/:inboxId', async (
    request: FastifyRequest<{
      Params: { inboxId: string };
      Querystring: { 'hub.mode'?: string; 'hub.verify_token'?: string; 'hub.challenge'?: string };
    }>,
    reply: FastifyReply,
  ) => {
    const { inboxId } = request.params;
    const mode = request.query['hub.mode'];
    const token = request.query['hub.verify_token'];
    const challenge = request.query['hub.challenge'];

    if (mode !== 'subscribe') {
      return reply.status(403).send({ error: 'Invalid mode' });
    }

    const prisma = getPrisma();

    const inbox = await prisma.inbox.findUnique({
      where: { id: inboxId },
      select: { id: true, providerConfig: true, provider: true },
    });

    if (!inbox || inbox.provider !== 'cloud_api') {
      return reply.status(404).send({ error: 'Inbox not found' });
    }

    const config = inbox.providerConfig as Record<string, unknown>;
    const verifyToken = config.verify_token as string;

    if (token !== verifyToken) {
      return reply.status(403).send({ error: 'Invalid verify token' });
    }

    return reply.status(200).send(challenge);
  });

  // ──────────────────────────────────────────────────────────
  // WhatsApp Cloud API Webhook — Events (POST)
  // ──────────────────────────────────────────────────────────

  fastify.post('/cloud/:inboxId', webhookRateLimit, async (
    request: FastifyRequest<{ Params: { inboxId: string }; Body: Record<string, unknown> }>,
    reply: FastifyReply,
  ) => {
    const { inboxId } = request.params;
    const payload = request.body as Record<string, unknown>;
    const prisma = getPrisma();

    // Validate inbox
    const inbox = await prisma.inbox.findUnique({
      where: { id: inboxId },
      select: { id: true, accountId: true, provider: true, providerConfig: true },
    });

    if (!inbox || inbox.provider !== 'cloud_api') {
      return reply.status(404).send({ error: 'Inbox not found or wrong provider' });
    }

    // Signature verification
    const config = inbox.providerConfig as Record<string, unknown>;
    const appSecret = config.app_secret as string | undefined;

    if (appSecret) {
      const signature = request.headers['x-hub-signature-256'] as string | undefined;
      if (!signature) {
        return reply.status(401).send({ error: 'Missing webhook signature' });
      }
      const rawBody = JSON.stringify(payload);
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signature);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return reply.status(401).send({ error: 'Invalid signature' });
      }
    }

    // Parse Cloud API structure: { object, entry: [{ id, changes: [{ value, field }] }] }
    const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];

      for (const change of changes) {
        const value = change.value as Record<string, unknown>;
        const field = change.field as string;

        // Build idempotency key
        const messages = (value?.messages as Array<Record<string, unknown>>) ?? [];
        const statuses = (value?.statuses as Array<Record<string, unknown>>) ?? [];

        // Process messages
        for (const msg of messages) {
          const msgId = msg.id as string;
          const idempotencyKey = `cloud:${inboxId}:${msgId}`;

          const existing = await prisma.webhookEvent.findUnique({
            where: { idempotencyKey },
          });

          if (existing) continue;

          const webhookEvent = await prisma.webhookEvent.create({
            data: {
              accountId: inbox.accountId,
              inboxId,
              provider: 'cloud_api',
              eventType: `${field}:message`,
              idempotencyKey,
              payload: { entry: entry, message: msg, metadata: value.metadata } as any,
            },
          });

          await getIncomingMessageQueue().add('process', {
            webhookEventId: webhookEvent.id,
            inboxId,
            accountId: inbox.accountId,
            provider: 'cloud_api',
            eventType: 'message',
            payload: {
              message: msg,
              contacts: value.contacts,
              metadata: value.metadata,
            },
          });
        }

        // Process status updates
        for (const statusUpdate of statuses) {
          const statusId = statusUpdate.id as string;
          const idempotencyKey = `cloud:${inboxId}:status:${statusId}:${statusUpdate.status}`;

          const existing = await prisma.webhookEvent.findUnique({
            where: { idempotencyKey },
          });

          if (existing) continue;

          const webhookEvent = await prisma.webhookEvent.create({
            data: {
              accountId: inbox.accountId,
              inboxId,
              provider: 'cloud_api',
              eventType: `${field}:status`,
              idempotencyKey,
              payload: { status: statusUpdate, metadata: value.metadata } as any,
            },
          });

          await getIncomingMessageQueue().add('process', {
            webhookEventId: webhookEvent.id,
            inboxId,
            accountId: inbox.accountId,
            provider: 'cloud_api',
            eventType: 'status',
            payload: { status: statusUpdate, metadata: value.metadata },
          });
        }
      }
    }

    return reply.status(200).send({ status: 'received' });
  });
}
