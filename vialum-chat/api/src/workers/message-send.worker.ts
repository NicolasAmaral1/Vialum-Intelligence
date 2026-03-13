import { Worker, Job, Queue, QueueEvents } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// Message Send Worker
// Queue: message-send
// Sends a message via the configured WhatsApp provider
// (Evolution API or Cloud API) and creates the Message record.
//
// Conversation Lock: Uses Redis SETNX to ensure only one job
// per conversation processes at a time. If locked, the job is
// re-enqueued with a short delay. This prevents race conditions
// when TreeFlow sends multiple messages without HITL.
// ════════════════════════════════════════════════════════════

const CONV_LOCK_PREFIX = 'msglock:';
const CONV_LOCK_TTL = 30; // seconds — auto-expire safety net

export interface MessageSendJobData {
  accountId: string;
  conversationId: string;
  inboxId?: string;
  messageId?: string;       // When sent from messages.service (message already in DB)
  content?: string;          // When sent from bot/automation (no message in DB yet)
  talkId?: string;
  suggestionId?: string;
  contentType?: string;
  senderType?: string;
  type?: 'typing';          // When set, just send typing presence (no message)
}

async function acquireConvLock(conversationId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${CONV_LOCK_PREFIX}${conversationId}`;
  const result = await (redis as any).set(key, '1', 'EX', CONV_LOCK_TTL, 'NX');
  return result === 'OK';
}

async function releaseConvLock(conversationId: string): Promise<void> {
  const redis = getRedis();
  const key = `${CONV_LOCK_PREFIX}${conversationId}`;
  await (redis as any).del(key);
}

export function createMessageSendWorker(io: SocketIOServer): Worker {
  const worker = new Worker<MessageSendJobData>(
    'message-send',
    async (job: Job<MessageSendJobData>) => {
      const prisma = getPrisma();
      const { accountId, conversationId, talkId, suggestionId } = job.data;

      // ── Handle typing presence jobs ──
      if (job.name === 'typing') {
        try {
          const conv = await prisma.conversation.findFirstOrThrow({
            where: { id: conversationId, accountId },
            include: {
              inbox: true,
              contactInbox: true,
              contact: { select: { phone: true } },
              group: { select: { jid: true } },
            },
          });
          const recipient = (conv.groupId && conv.group)
            ? conv.group.jid
            : (conv.contactInbox?.sourceId ?? conv.contact.phone);
          if (recipient && conv.inbox.provider === 'evolution_api') {
            const pc = conv.inbox.providerConfig as Record<string, any>;
            const baseUrl = pc.base_url ?? pc.baseUrl;
            const instanceName = pc.instance_name ?? pc.instanceName;
            const apiKey = pc.api_key ?? pc.apiKey;
            const phone = recipient.includes('@g.us') ? recipient : recipient.replace('@s.whatsapp.net', '');
            await fetch(`${baseUrl}/chat/updatePresence/${instanceName}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: apiKey },
              body: JSON.stringify({ number: phone, presence: 'composing' }),
            }).catch(() => {});
          }
          job.log(`Typing presence sent for conversation ${conversationId}`);
        } catch {
          job.log(`Typing presence failed (non-critical) for ${conversationId}`);
        }
        return { type: 'typing' };
      }

      // ── Conversation lock: sequential per conversation ──
      const gotLock = await acquireConvLock(conversationId);
      if (!gotLock) {
        // Another job for this conversation is running — re-enqueue with delay
        const queue = new Queue('message-send', { connection: getRedis() as any });
        await queue.add(job.name, job.data, {
          delay: 1500,
          attempts: job.opts.attempts,
          backoff: job.opts.backoff,
        });
        await queue.close();
        job.log(`Conversation ${conversationId} locked, re-enqueued with 1.5s delay`);
        return { requeued: true };
      }

      try {
        return await processMessageJob(job, prisma, io);
      } finally {
        await releaseConvLock(conversationId);
      }
    },
    {
      connection: getRedis() as any,
      concurrency: 10,
      limiter: {
        max: 30,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[message:send] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[message:send] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ── Core message processing (extracted for lock wrapping) ──

async function processMessageJob(
  job: Job<MessageSendJobData>,
  prisma: ReturnType<typeof getPrisma>,
  io: SocketIOServer,
) {
  const { accountId, conversationId, talkId, suggestionId } = job.data;

  job.log(`Sending message for conversation ${conversationId}`);

  // ── Resolve message content ──
  let messageId = job.data.messageId;
  let content: string;
  let contentType: string;
  let senderType: string;

  if (messageId) {
    const existingMsg = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existingMsg) throw new Error(`Message ${messageId} not found`);
    if (existingMsg.status === 'queued') {
      await prisma.message.update({ where: { id: messageId }, data: { status: 'sending' } });
    }
    content = String(existingMsg.content ?? '');
    contentType = existingMsg.contentType ?? 'text';
    senderType = existingMsg.senderType ?? 'user';
  } else {
    content = job.data.content ?? '';
    contentType = job.data.contentType ?? 'text';
    senderType = job.data.senderType ?? 'bot';
  }

  if (!content) throw new Error('No content to send');

  // Load conversation with inbox config
  const conversation = await prisma.conversation.findFirstOrThrow({
    where: { id: conversationId, accountId },
    include: {
      inbox: true,
      contactInbox: true,
      contact: { select: { phone: true } },
      group: { select: { jid: true } },
    },
  });

  const inbox = conversation.inbox;
  const providerConfig = inbox.providerConfig as Record<string, any>;

  // For group conversations, send to the group JID; otherwise use contact sourceId/phone
  const recipientId = (conversation.groupId && conversation.group)
    ? conversation.group.jid
    : (conversation.contactInbox?.sourceId ?? conversation.contact.phone);

  if (!recipientId) {
    throw new Error(`No recipient ID for conversation ${conversationId}`);
  }

  // ── Send via Provider ──
  let externalMessageId: string | null = null;

  if (inbox.provider === 'evolution_api') {
    externalMessageId = await sendViaEvolutionAPI(providerConfig, recipientId, content);
  } else if (inbox.provider === 'cloud_api') {
    externalMessageId = await sendViaCloudAPI(providerConfig, recipientId, content);
  } else {
    throw new Error(`Unknown provider: ${inbox.provider}`);
  }

  // ── Create or Update Message record ──
  let message;
  if (messageId) {
    message = await prisma.message.update({
      where: { id: messageId },
      data: { status: 'sent', externalMessageId },
    });
  } else {
    message = await prisma.message.create({
      data: {
        accountId,
        conversationId,
        inboxId: inbox.id,
        senderType,
        content,
        messageType: 'outgoing',
        contentType,
        status: 'sent',
        externalMessageId,
      },
    });
    messageId = message.id;
  }

  // ── Link to Talk if applicable ──
  if (talkId) {
    await prisma.talkMessage.create({
      data: {
        talkId,
        messageId: message.id,
        routingConfidence: 1.0,
        routedBy: 'system',
      },
    });
  }

  // ── Update suggestion status if applicable ──
  if (suggestionId) {
    await prisma.aISuggestion.update({
      where: { id: suggestionId },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  // ── Update conversation ──
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastActivityAt: new Date() },
  });

  // ── Stop typing presence after sending (anti-ban) ──
  if (inbox.provider === 'evolution_api') {
    try {
      const pc = inbox.providerConfig as Record<string, any>;
      const baseUrl = pc.base_url ?? pc.baseUrl;
      const instanceName = pc.instance_name ?? pc.instanceName;
      const apiKey = pc.api_key ?? pc.apiKey;
      const phone = recipientId.includes('@g.us') ? recipientId : recipientId.replace('@s.whatsapp.net', '');
      await fetch(`${baseUrl}/chat/updatePresence/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify({ number: phone, presence: 'paused' }),
      }).catch(() => {});
    } catch { /* non-critical */ }
  }

  // ── Emit WebSocket ──
  io.to(`conversation:${conversationId}`).emit('message:created', {
    message: {
      id: message.id,
      conversationId,
      content: String(message.content ?? ''),
      senderType: message.senderType,
      messageType: message.messageType,
      contentType: message.contentType,
      status: message.status,
      createdAt: message.createdAt,
    },
  });

  job.log(`Message ${message.id} sent successfully (external: ${externalMessageId})`);
  return { messageId: message.id, externalMessageId };
}

// ── Provider Implementations ──

async function sendViaEvolutionAPI(
  config: Record<string, any>,
  recipientId: string,
  content: string,
): Promise<string> {
  const baseUrl = config.base_url ?? config.baseUrl;
  const instanceName = config.instance_name ?? config.instanceName;
  const apiKey = config.api_key ?? config.apiKey;

  // For group JIDs (@g.us), keep the full JID; for individual, strip suffix
  const phone = recipientId.includes('@g.us') ? recipientId : recipientId.replace('@s.whatsapp.net', '');

  const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey,
    },
    body: JSON.stringify({
      number: phone,
      text: content,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Evolution API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json() as Record<string, any>;
  return result.key?.id ?? result.messageId ?? `evo_${Date.now()}`;
}

async function sendViaCloudAPI(
  config: Record<string, any>,
  recipientId: string,
  content: string,
): Promise<string> {
  const phoneNumberId = config.phone_number_id ?? config.phoneNumberId;
  const accessToken = config.access_token ?? config.accessToken;

  const phone = recipientId.includes('@g.us') ? recipientId : recipientId.replace('@s.whatsapp.net', '');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: content },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Cloud API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json() as Record<string, any>;
  return result.messages?.[0]?.id ?? `cloud_${Date.now()}`;
}
