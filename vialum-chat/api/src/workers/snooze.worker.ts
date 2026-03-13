import { Worker, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// Snooze Worker
// Queue: conversation:snooze-check
// Cron job: reopens snoozed conversations whose snooze
// period has expired.
// ════════════════════════════════════════════════════════════

export interface SnoozeCheckJobData {
  triggeredAt: string;
}

export function createSnoozeWorker(io: SocketIOServer): Worker {
  const worker = new Worker<SnoozeCheckJobData>(
    'conversation-snooze-check',
    async (job) => {
      const prisma = getPrisma();

      job.log('Checking for expired snoozed conversations...');

      const now = new Date();

      // Find all snoozed conversations past their snooze time
      const expiredConversations = await prisma.conversation.findMany({
        where: {
          status: 'snoozed',
          snoozedUntil: { lte: now },
        },
        select: {
          id: true,
          accountId: true,
        },
      });

      if (expiredConversations.length === 0) {
        job.log('No expired snoozed conversations');
        return { reopenedCount: 0 };
      }

      let reopenedCount = 0;

      for (const conv of expiredConversations) {
        try {
          await prisma.conversation.update({
            where: { id: conv.id },
            data: {
              status: 'open',
              snoozedUntil: null,
            },
          });

          io.to(`account:${conv.accountId}`).emit('conversation:reopened', {
            conversationId: conv.id,
            reason: 'snooze_expired',
          });

          io.to(`conversation:${conv.id}`).emit('conversation:status_changed', {
            conversationId: conv.id,
            status: 'open',
            previousStatus: 'snoozed',
          });

          reopenedCount++;
        } catch (err) {
          console.error(`[snooze] Failed to reopen conversation ${conv.id}:`, err);
        }
      }

      job.log(`Reopened ${reopenedCount} snoozed conversations`);
      return { reopenedCount };
    },
    {
      connection: getRedis() as any,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[conversation:snooze-check] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[conversation:snooze-check] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Sets up the repeating cron job for snooze checks.
 * Call this once at startup.
 */
export async function scheduleSnoozeChecks(): Promise<void> {
  const queue = new Queue('conversation-snooze-check', { connection: getRedis() as any });

  // Remove existing repeatable jobs
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Schedule every minute
  await queue.add(
    'check-snooze',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: '* * * * *' },
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 20 },
    },
  );

  await queue.close();
  console.log('[conversation:snooze-check] Scheduled repeating job every minute');
}
