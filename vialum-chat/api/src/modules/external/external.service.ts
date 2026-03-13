import { getPrisma } from '../../config/database.js';
import { Queue } from 'bullmq';
import { getRedis } from '../../config/redis.js';
import { Server as SocketIOServer } from 'socket.io';

let sendMessageQueue: Queue | null = null;

function getSendMessageQueue(): Queue {
  if (!sendMessageQueue) {
    sendMessageQueue = new Queue('message-send', {
      connection: getRedis() as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return sendMessageQueue;
}

export interface ExternalMessageInput {
  phone: string;
  inboxId: string;
  content: string;
  mode: 'hitl' | 'direct';
  senderLabel?: string;
  blockDelay?: number;
  metadata?: Record<string, unknown>;
}

export async function sendExternalMessage(
  accountId: string,
  input: ExternalMessageInput,
  io?: SocketIOServer,
) {
  const prisma = getPrisma();

  // ── 1. Validate inbox belongs to account ──
  const inbox = await prisma.inbox.findFirst({
    where: { id: input.inboxId, accountId },
    select: { id: true, accountId: true },
  });

  if (!inbox) {
    throw { statusCode: 404, message: 'Inbox not found for this account', code: 'INBOX_NOT_FOUND' };
  }

  // ── 2. Find or create contact ──
  let contact = await prisma.contact.findFirst({
    where: { accountId, phone: input.phone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        accountId,
        name: input.phone,
        phone: input.phone,
      },
    });
  }

  // ── 3. Find or create ContactInbox ──
  const sourceId = `${input.phone}@s.whatsapp.net`;

  let contactInbox = await prisma.contactInbox.findUnique({
    where: { inboxId_sourceId: { inboxId: input.inboxId, sourceId } },
  });

  if (!contactInbox) {
    contactInbox = await prisma.contactInbox.create({
      data: {
        contactId: contact.id,
        inboxId: input.inboxId,
        sourceId,
      },
    });
  }

  // ── 4. Find or create conversation ──
  let conversation = await prisma.conversation.findFirst({
    where: {
      accountId,
      contactId: contact.id,
      inboxId: input.inboxId,
      status: { in: ['open', 'pending'] },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        accountId,
        inboxId: input.inboxId,
        contactId: contact.id,
        contactInboxId: contactInbox.id,
        status: 'open',
      },
    });
  }

  // ── 5. Mode-specific logic ──
  if (input.mode === 'hitl') {
    return handleHitlMode(accountId, conversation, contact, input, io);
  } else {
    return handleDirectMode(accountId, conversation, input);
  }
}

async function handleHitlMode(
  accountId: string,
  conversation: { id: string; inboxId: string },
  contact: { id: string },
  input: ExternalMessageInput,
  io?: SocketIOServer,
) {
  const prisma = getPrisma();

  const suggestion = await prisma.aISuggestion.create({
    data: {
      accountId,
      conversationId: conversation.id,
      triggeredBy: 'webhook',
      content: input.content,
      status: 'pending',
      autoMode: false,
      context: {
        source: 'external_api',
        senderLabel: input.senderLabel ?? 'External AI',
        blockDelay: input.blockDelay ?? 0,
        metadata: input.metadata ?? {},
      } as any,
    },
  });

  // Update conversation activity
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastActivityAt: new Date() },
  });

  // Emit WebSocket event for real-time UI update
  if (io) {
    io.to(`account:${accountId}`).emit('suggestion:created', {
      conversationId: conversation.id,
      suggestionId: suggestion.id,
      content: input.content,
      context: suggestion.context,
    });
  }

  return {
    status: 'queued' as const,
    suggestionId: suggestion.id,
    conversationId: conversation.id,
    contactId: contact.id,
  };
}

async function handleDirectMode(
  accountId: string,
  conversation: { id: string; inboxId: string },
  input: ExternalMessageInput,
) {
  const prisma = getPrisma();

  const message = await prisma.message.create({
    data: {
      accountId,
      conversationId: conversation.id,
      inboxId: conversation.inboxId,
      senderType: 'bot',
      content: input.content,
      messageType: 'outgoing',
      contentType: 'text',
      status: 'sending',
    },
  });

  // Update conversation activity
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastActivityAt: new Date(),
      ...(conversation as any).status === 'resolved' && { status: 'open' },
    },
  });

  // Enqueue send job
  await getSendMessageQueue().add('send', {
    accountId,
    conversationId: conversation.id,
    messageId: message.id,
    inboxId: conversation.inboxId,
  });

  return {
    status: 'sent' as const,
    messageId: message.id,
    conversationId: conversation.id,
    contactId: (conversation as any).contactId,
  };
}
