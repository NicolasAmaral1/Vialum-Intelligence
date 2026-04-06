import { Worker, Job, Queue, QueueEvents } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';
import { getWhatsAppProvider } from '../providers/factory.js';

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
const CONV_LOCK_TTL = 120; // seconds — auto-expire safety net (increased to avoid out-of-order messages)

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
          if (recipient) {
            const provider = getWhatsAppProvider(conv.inbox.provider);
            if (provider.sendPresence) {
              await provider.sendPresence(conv.inbox.providerConfig as Record<string, any>, recipient, 'composing');
            }
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

  worker.on('failed', async (job, err) => {
    console.error(`[message:send] Job ${job?.id} failed:`, err.message);

    // If all retries exhausted, mark message as 'failed'
    if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
      try {
        const prisma = getPrisma();
        const { messageId, conversationId } = job.data;
        if (messageId) {
          await prisma.message.update({
            where: { id: messageId },
            data: { status: 'failed' },
          });
          // Emit failure event to connected clients
          io.to(`conversation:${conversationId}`).emit('message:created', {
            message: { id: messageId, conversationId, status: 'failed' },
          });
        }
      } catch (updateErr) {
        console.error(`[message:send] Failed to mark message as failed:`, updateErr);
      }
    }
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
  const rawRecipient = (conversation.groupId && conversation.group)
    ? conversation.group.jid
    : (conversation.contactInbox?.sourceId ?? conversation.contact.phone);

  // Ensure JID format for Evolution API (phone must end with @s.whatsapp.net)
  const recipientId = rawRecipient && !rawRecipient.includes('@')
    ? `${rawRecipient}@s.whatsapp.net`
    : rawRecipient;

  if (!recipientId) {
    throw new Error(`No recipient ID for conversation ${conversationId}`);
  }

  // ── Send via Provider (adapter pattern) ──
  const whatsappProvider = getWhatsAppProvider(inbox.provider);
  const sendResult = await whatsappProvider.sendText(providerConfig, {
    to: recipientId,
    text: content,
  });
  const externalMessageId = sendResult.externalMessageId || null;

  // ── Persist all DB changes atomically ──
  const message = await prisma.$transaction(async (tx) => {
    let msg;
    if (messageId) {
      msg = await tx.message.update({
        where: { id: messageId },
        data: { status: 'sent', externalMessageId },
      });
    } else {
      msg = await tx.message.create({
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
      messageId = msg.id;
    }

    if (talkId) {
      await tx.talkMessage.create({
        data: {
          talkId,
          messageId: msg.id,
          routingConfidence: 1.0,
          routedBy: 'system',
        },
      });
    }

    if (suggestionId) {
      await tx.aISuggestion.update({
        where: { id: suggestionId },
        data: { status: 'sent', sentAt: new Date() },
      });
    }

    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date() },
    });

    return msg;
  });

  // ── Stop typing presence after sending (anti-ban) ──
  if (whatsappProvider.sendPresence) {
    whatsappProvider.sendPresence(providerConfig, recipientId, 'paused').catch((err) => console.error("[background]", err.message || err));
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

// Provider-specific send functions removed — now using adapter pattern via getWhatsAppProvider()
