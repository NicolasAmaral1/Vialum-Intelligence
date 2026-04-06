import { Worker, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';

// ════════════════════════════════════════════════════════════
// Webhook Cleanup Worker
// Queue: webhook-cleanup
// Cron job: deletes processed webhook events older than 30 days.
// ════════════════════════════════════════════════════════════

const RETENTION_DAYS = 30;

export function createWebhookCleanupWorker(): Worker {
  return new Worker<{ triggeredAt: string }>(
    'webhook-cleanup',
    async (job) => {
      const prisma = getPrisma();
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const BATCH_SIZE = 1000;
      let totalDeleted = 0;

      // Delete in batches to avoid locking the table for too long
      while (true) {
        const deleted = await prisma.$executeRaw`
          DELETE FROM "webhook_events"
          WHERE id IN (
            SELECT id FROM "webhook_events"
            WHERE processed = true AND created_at < ${cutoff}
            LIMIT ${BATCH_SIZE}
          )
        `;

        if (deleted === 0) break;
        totalDeleted += deleted;
        job.log(`Batch deleted ${deleted} events (total: ${totalDeleted})`);

        // Yield to other queries between batches
        await new Promise((r) => setTimeout(r, 100));
      }

      job.log(`Cleanup complete: deleted ${totalDeleted} processed webhook events older than ${RETENTION_DAYS} days`);
      return { deletedCount: totalDeleted };
    },
    { connection: getRedis() as any, concurrency: 1 },
  );
}

export async function scheduleWebhookCleanup(): Promise<void> {
  const queue = new Queue('webhook-cleanup', { connection: getRedis() as any });

  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add(
    'cleanup',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: '0 3 * * *' }, // Daily at 3 AM
      removeOnComplete: { count: 5 },
      removeOnFail: { count: 10 },
    },
  );

  await queue.close();
  console.log('[webhook-cleanup] Scheduled daily cleanup at 3 AM');
}
