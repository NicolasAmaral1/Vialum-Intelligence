import { getPrisma } from '../../config/database.js';
import { Queue } from 'bullmq';
import { getRedis } from '../../config/redis.js';

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

export interface CreateMessageInput {
  content?: string | null;
  messageType?: string;
  contentType?: string;
  contentAttributes?: Record<string, unknown>;
  private?: boolean;
}

export interface ListMessagesFilters {
  beforeId?: string;
  limit?: number;
}

export async function create(
  accountId: string,
  conversationId: string,
  senderId: string,
  data: CreateMessageInput,
) {
  const prisma = getPrisma();

  // Verify conversation belongs to account
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
    select: { id: true, inboxId: true, contactId: true, status: true },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  const message = await prisma.message.create({
    data: {
      accountId,
      conversationId,
      inboxId: conversation.inboxId,
      senderType: 'user',
      senderId,
      content: data.content ?? null,
      messageType: data.messageType ?? 'outgoing',
      contentType: data.contentType ?? 'text',
      contentAttributes: (data.contentAttributes ?? {}) as any,
      status: data.private ? 'sent' : 'sending',
      private: data.private ?? false,
    },
  });

  // Update conversation last activity and reopen if resolved
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastActivityAt: new Date(),
      ...(conversation.status === 'resolved' && { status: 'open' }),
    },
  });

  // Enqueue send job for non-private messages
  if (!data.private) {
    const content = String(data.content ?? '');
    const chunks = splitMessageChunks(content);

    if (chunks.length > 1) {
      // ── Multi-chunk: split with humanized typing simulation ──
      // All jobs use the same conversationId as groupId for sequential processing
      let cumulativeDelay = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let msgId: string;

        if (i === 0) {
          await prisma.message.update({
            where: { id: message.id },
            data: { content: chunk, status: 'queued' },
          });
          msgId = message.id;
        } else {
          const chunkMsg = await prisma.message.create({
            data: {
              accountId,
              conversationId,
              inboxId: conversation.inboxId,
              senderType: 'user',
              senderId,
              content: chunk,
              messageType: 'outgoing',
              contentType: 'text',
              contentAttributes: {} as any,
              status: 'queued',
              private: false,
            },
          });
          msgId = chunkMsg.id;
        }

        // ── Delay humanizado ──
        // Chunk 0: envia imediatamente (sem delay)
        // Chunks 1+: pausa de leitura (4-8s) + typing proporcional ao nº de caracteres
        if (i > 0) {
          // 1) Pausa de "leitura" antes de começar a digitar (4-8s)
          const readPause = Math.round(4000 + Math.random() * 4000);
          cumulativeDelay += readPause;

          // 2) Envia presença "composing" após a pausa
          await getSendMessageQueue().add('typing', {
            accountId,
            conversationId,
          }, { delay: cumulativeDelay, jobId: `typing-${msgId}` });

          // 3) Tempo de digitação: chars × velocidade humana média (40-85ms/char)
          //    Humano médio digita ~200 CPM (~60ms/char), variamos para parecer natural
          const typingSpeedMs = 40 + Math.random() * 45;
          const typingTime = Math.round(chunk.length * typingSpeedMs);
          // Mínimo 1.5s (msg curta), máximo 15s (msg longa — ninguém digita 15s sem pausa)
          const clampedTyping = Math.max(1500, Math.min(15000, typingTime));
          cumulativeDelay += clampedTyping;
        }

        // Enqueue send job
        await getSendMessageQueue().add('send', {
          messageId: msgId,
          accountId,
          conversationId,
          inboxId: conversation.inboxId,
        }, {
          delay: i === 0 ? 0 : cumulativeDelay,
          jobId: `send-${msgId}`,
        });
      }
    } else {
      // Single message: send immediately
      await getSendMessageQueue().add('send', {
        messageId: message.id,
        accountId,
        conversationId,
        inboxId: conversation.inboxId,
      });
    }
  }

  return message;
}

export async function list(
  accountId: string,
  conversationId: string,
  filters: ListMessagesFilters,
) {
  const prisma = getPrisma();
  const limit = Math.min(filters.limit ?? 30, 100);

  // Verify conversation belongs to account
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, accountId, deletedAt: null },
    select: { id: true },
  });

  if (!conversation) {
    throw { statusCode: 404, message: 'Conversation not found', code: 'CONVERSATION_NOT_FOUND' };
  }

  // Cursor-based pagination using before_id
  let cursor: { id: string } | undefined;
  let skip: number | undefined;

  if (filters.beforeId) {
    cursor = { id: filters.beforeId };
    skip = 1; // Skip the cursor itself
  }

  const messages = await prisma.message.findMany({
    where: { conversationId, accountId },
    include: {
      senderContact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    ...(cursor && { cursor, skip }),
  });

  // Reset unread count when messages are fetched (first page only)
  if (!filters.beforeId) {
    prisma.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    }).catch((err) => console.error("[background]", err.message || err)); // fire-and-forget
  }

  const hasMore = messages.length === limit;

  return {
    data: messages.reverse(), // Return in chronological order
    meta: {
      hasMore,
      ...(messages.length > 0 && { oldestId: messages[0].id }),
    },
  };
}

/**
 * Splits message content on double newlines (\n\n) into separate chunks.
 * Each chunk is trimmed; empty chunks are discarded.
 * Returns single-element array if no split needed.
 */
function splitMessageChunks(content: string): string[] {
  const chunks = content
    .split(/\n\s*\n/) // split on blank lines (handles \n\n, \n  \n, etc.)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return chunks.length > 0 ? chunks : [content];
}

export async function updateStatus(messageId: string, status: string, externalMessageId?: string) {
  const prisma = getPrisma();

  const updateData: Record<string, unknown> = { status };
  if (externalMessageId) {
    updateData.externalMessageId = externalMessageId;
  }

  return prisma.message.update({
    where: { id: messageId },
    data: updateData,
  });
}
