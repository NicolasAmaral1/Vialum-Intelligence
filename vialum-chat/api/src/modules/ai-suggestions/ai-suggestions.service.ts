import { getPrisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
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

export interface AISuggestionFilters {
  status?: string;
  conversationId?: string;
  talkId?: string;
  page?: number;
  limit?: number;
}

export interface UpdateSuggestionInput {
  status: 'approved' | 'rejected' | 'edited';
  editedContent?: string;
}

// ── Block splitting helpers ──

function splitBlock(content: string): string[] {
  return content.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);
}

function calcTypingDelay(text: string): number {
  const base = 1200 + text.length * 45;
  const jitter = (Math.random() - 0.5) * 0.5 * base;
  return Math.max(1500, Math.min(8000, Math.round(base + jitter)));
}

export interface BulkUpdateInput {
  ids: string[];
  status: 'approved' | 'rejected';
}

export async function findAll(accountId: string, filters: AISuggestionFilters) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.AISuggestionWhereInput = { accountId };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.conversationId) {
    where.conversationId = filters.conversationId;
  }

  if (filters.talkId) {
    where.talkId = filters.talkId;
  }

  const [data, total] = await Promise.all([
    prisma.aISuggestion.findMany({
      where,
      include: {
        conversation: {
          select: {
            id: true,
            inboxId: true,
            contact: { select: { id: true, name: true, phone: true } },
          },
        },
        talk: { select: { id: true, status: true, treeFlowId: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.aISuggestion.count({ where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateSuggestion(
  accountId: string,
  suggestionId: string,
  userId: string,
  data: UpdateSuggestionInput,
) {
  const prisma = getPrisma();

  const existing = await prisma.aISuggestion.findFirst({
    where: { id: suggestionId, accountId },
    include: {
      conversation: { select: { id: true, inboxId: true, accountId: true, status: true } },
    },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'AI suggestion not found', code: 'AI_SUGGESTION_NOT_FOUND' };
  }

  if (existing.status !== 'pending') {
    throw { statusCode: 409, message: 'Suggestion has already been reviewed', code: 'ALREADY_REVIEWED' };
  }

  const contentToSend = data.status === 'edited' ? data.editedContent : existing.content;
  const newStatus = data.status === 'edited' ? 'edited' : data.status;

  const updated = await prisma.aISuggestion.update({
    where: { id: suggestionId },
    data: {
      status: newStatus,
      editedContent: data.editedContent ?? null,
      reviewedBy: userId,
      reviewedAt: new Date(),
    },
  });

  // On approve or edited: split into block messages and enqueue with delays
  if (data.status === 'approved' || data.status === 'edited') {
    const parts = splitBlock(contentToSend ?? '');
    const blockDelay = (existing.context as any)?.blockDelay ?? 0;
    const queue = getSendMessageQueue();

    let cumulativeDelay = blockDelay;

    for (let i = 0; i < parts.length; i++) {
      const partContent = parts[i];
      const typingDuration = calcTypingDelay(partContent);

      // Create message record with 'queued' status
      const message = await prisma.message.create({
        data: {
          accountId,
          conversationId: existing.conversationId,
          inboxId: existing.conversation.inboxId,
          senderType: 'user',
          senderId: userId,
          content: partContent,
          messageType: 'outgoing',
          contentType: 'text',
          status: 'queued',
        },
      });

      // Job 1: Typing presence indicator
      await queue.add('typing', {
        accountId,
        conversationId: existing.conversationId,
        inboxId: existing.conversation.inboxId,
      }, { delay: cumulativeDelay });

      cumulativeDelay += typingDuration;

      // Job 2: Send the message (only last job updates suggestion)
      await queue.add('send', {
        messageId: message.id,
        accountId,
        conversationId: existing.conversationId,
        inboxId: existing.conversation.inboxId,
        suggestionId: i === parts.length - 1 ? suggestionId : undefined,
      }, { delay: cumulativeDelay });

      // Inter-message gap
      cumulativeDelay += 800 + Math.floor(Math.random() * 700);
    }

    // Update conversation activity
    await prisma.conversation.update({
      where: { id: existing.conversationId },
      data: {
        lastActivityAt: new Date(),
        ...(existing.conversation.status === 'resolved' && { status: 'open' }),
      },
    });
  }

  return updated;
}

export async function bulkUpdate(
  accountId: string,
  userId: string,
  data: BulkUpdateInput,
) {
  const prisma = getPrisma();
  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const id of data.ids) {
    try {
      const updated = await updateSuggestion(accountId, id, userId, { status: data.status });
      results.push({ id, status: updated.status });
    } catch (err: any) {
      results.push({ id, status: 'error', error: err.message ?? 'Unknown error' });
    }
  }

  return results;
}
