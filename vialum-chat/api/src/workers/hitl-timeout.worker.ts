import { Worker, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// HITL Timeout Worker
// Queue: hitl-timeout-check
// Cron job: expires pending AI suggestions that have not been
// reviewed within the timeout window (30 minutes).
// ════════════════════════════════════════════════════════════

const TIMEOUT_MINUTES = 30;

export function createHitlTimeoutWorker(io: SocketIOServer): Worker {
  const worker = new Worker<{ triggeredAt: string }>(
    'hitl-timeout-check',
    async (job) => {
      const prisma = getPrisma();
      const cutoff = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

      job.log(`Checking for pending suggestions older than ${TIMEOUT_MINUTES}m...`);

      const expired = await prisma.aISuggestion.findMany({
        where: {
          status: 'pending',
          createdAt: { lt: cutoff },
        },
        select: { id: true, conversationId: true, accountId: true },
      });

      if (expired.length === 0) {
        job.log('No expired suggestions');
        return { expiredCount: 0 };
      }

      let expiredCount = 0;

      for (const suggestion of expired) {
        try {
          await prisma.aISuggestion.update({
            where: { id: suggestion.id },
            data: { status: 'expired', reviewedAt: new Date() },
          });

          io.to(`conversation:${suggestion.conversationId}`).emit('suggestion:expired', {
            suggestionId: suggestion.id,
            conversationId: suggestion.conversationId,
          });

          io.to(`account:${suggestion.accountId}`).emit('suggestion:expired', {
            suggestionId: suggestion.id,
            conversationId: suggestion.conversationId,
          });

          expiredCount++;
        } catch (err) {
          console.error(`[hitl-timeout] Failed to expire suggestion ${suggestion.id}:`, err);
        }
      }

      job.log(`Expired ${expiredCount} pending suggestions`);
      return { expiredCount };
    },
    {
      connection: getRedis() as any,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[hitl-timeout] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[hitl-timeout] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

export async function scheduleHitlTimeoutChecks(): Promise<void> {
  const queue = new Queue('hitl-timeout-check', { connection: getRedis() as any });

  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add(
    'check-hitl-timeout',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: '*/2 * * * *' }, // Every 2 minutes
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 20 },
    },
  );

  await queue.close();
  console.log('[hitl-timeout] Scheduled repeating job every 2 minutes');
}
