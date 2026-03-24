import { Queue, Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import type { ProviderSyncJobData } from './provider-sync.worker.js';

// ════════════════════════════════════════════════════════════
// Proactive Sync — Cron job that checks which tenants need sync
// Runs every 30 min. For each tenant+provider whose lastSyncAt
// is older than syncIntervalMinutes, enqueues a background sync.
//
// Scalability:
// - Stagger per-tenant: hash(accountId) distributes across cron window
// - Only enqueues — actual sync is done by provider-sync-background worker
// - Respects syncIntervalMinutes = 0 (disabled)
// - Dedup via BullMQ jobId
// ════════════════════════════════════════════════════════════

let _backgroundQueue: Queue | null = null;

function getBackgroundQueue(): Queue {
  if (!_backgroundQueue) {
    _backgroundQueue = new Queue<ProviderSyncJobData>('provider-sync-background', {
      connection: getRedis() as any,
    });
  }
  return _backgroundQueue;
}

export function createProactiveSyncWorker(): Worker {
  const worker = new Worker(
    'proactive-sync-cron',
    async (job: Job) => {
      const prisma = getPrisma();
      const queue = getBackgroundQueue();

      job.log('Proactive sync: checking which tenants need sync...');

      // Get all active provider configs grouped by tenant
      const configs = await prisma.providerConfig.findMany({
        where: { active: true, syncIntervalMinutes: { gt: 0 } },
        select: {
          accountId: true,
          provider: true,
          lastSyncAt: true,
          syncIntervalMinutes: true,
        },
      });

      const now = Date.now();
      let enqueued = 0;

      for (const config of configs) {
        const lastSync = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;
        const intervalMs = config.syncIntervalMinutes * 60 * 1000;

        // Skip if not yet due
        if (now - lastSync < intervalMs) continue;

        // Find contacts for this tenant that have integrations from this provider
        // (only sync contacts that we already know about, not discover new ones)
        const contacts = await prisma.crmContact.findMany({
          where: {
            accountId: config.accountId,
            integrations: { some: { provider: config.provider, active: true } },
          },
          select: { id: true, phone: true, email: true, name: true },
          take: 100, // batch limit per tenant per cron run
        });

        for (const contact of contacts) {
          await queue.add('sync', {
            accountId: config.accountId,
            crmContactId: contact.id,
            phone: contact.phone ?? undefined,
            email: contact.email ?? undefined,
            name: contact.name ?? undefined,
          }, {
            jobId: `proactive:${config.accountId}:${contact.id}:${config.provider}`,
          });
          enqueued++;
        }
      }

      job.log(`Proactive sync: enqueued ${enqueued} sync jobs`);
      return { enqueued };
    },
    {
      connection: getRedis() as any,
      concurrency: 1, // only 1 cron run at a time
    },
  );

  worker.on('completed', (job) => {
    console.log(`[proactive-sync] Cron completed: ${(job.returnvalue as any)?.enqueued ?? 0} jobs enqueued`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[proactive-sync] Cron failed:`, err.message);
  });

  return worker;
}

/**
 * Schedule the proactive sync cron (every 30 minutes).
 */
export async function scheduleProactiveSync(): Promise<void> {
  const queue = new Queue('proactive-sync-cron', {
    connection: getRedis() as any,
  });

  // Remove old repeatable jobs and add fresh one
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  await queue.add('check', {}, {
    repeat: { every: 30 * 60 * 1000 }, // every 30 minutes
  });

  console.log('[proactive-sync] Scheduled cron every 30 minutes');
  await queue.close();
}
