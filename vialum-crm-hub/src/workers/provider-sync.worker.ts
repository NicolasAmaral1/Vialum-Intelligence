import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { syncProviders } from '../lib/sync.js';

// ════════════════════════════════════════════════════════════
// Provider Sync Worker
// Processes two queues:
//   - provider-sync-priority: on-demand refresh (user clicks "refresh")
//   - provider-sync-background: stale data refresh (automatic)
// ════════════════════════════════════════════════════════════

export interface ProviderSyncJobData {
  accountId: string;
  crmContactId: string;
  phone?: string;
  email?: string;
  name?: string;
  forceSync?: boolean;
}

async function processSync(job: Job<ProviderSyncJobData>) {
  const prisma = getPrisma();
  const { accountId, crmContactId, phone, email, name } = job.data;

  job.log(`Syncing providers for contact ${crmContactId} (account: ${accountId})`);

  // Get only active providers for this tenant
  const activeProviders = await prisma.providerConfig.findMany({
    where: { accountId, active: true },
    select: { provider: true, lastSyncAt: true },
  });

  if (activeProviders.length === 0) {
    job.log('No active providers for this tenant');
    return { synced: 0 };
  }

  // Filter to only stale providers (unless forceSync)
  const staleThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour
  const providersToSync = job.data.forceSync
    ? activeProviders.map((p) => p.provider)
    : activeProviders
        .filter((p) => !p.lastSyncAt || p.lastSyncAt < staleThreshold)
        .map((p) => p.provider);

  if (providersToSync.length === 0) {
    job.log('All providers are fresh');
    return { synced: 0 };
  }

  job.log(`Syncing ${providersToSync.length} providers: ${providersToSync.join(', ')}`);

  const result = await syncProviders(accountId, crmContactId, {
    phone: phone ?? undefined,
    email: email ?? undefined,
    name: name ?? undefined,
  });

  // Update lastSyncAt for each synced provider
  for (const provider of providersToSync) {
    await prisma.providerConfig.updateMany({
      where: { accountId, provider },
      data: { lastSyncAt: new Date() },
    }).catch((err) => console.error(`[provider-sync] Failed to update lastSyncAt for ${provider}:`, err.message));
  }

  job.log(`Synced ${result.length} resources`);
  return { synced: result.length, providers: providersToSync };
}

export function createProviderSyncWorkers() {
  const connection = getRedis() as any;

  const priorityWorker = new Worker<ProviderSyncJobData>(
    'provider-sync-priority',
    processSync,
    {
      connection,
      concurrency: 5,
    },
  );

  const backgroundWorker = new Worker<ProviderSyncJobData>(
    'provider-sync-background',
    processSync,
    {
      connection,
      concurrency: 10,
      limiter: { max: 2, duration: 1000 }, // max 2 jobs/sec globally
    },
  );

  priorityWorker.on('completed', (job) => {
    console.log(`[provider-sync:priority] Job ${job.id} completed`);
  });

  priorityWorker.on('failed', (job, err) => {
    console.error(`[provider-sync:priority] Job ${job?.id} failed:`, err.message);
  });

  backgroundWorker.on('completed', (job) => {
    console.log(`[provider-sync:background] Job ${job.id} completed`);
  });

  backgroundWorker.on('failed', (job, err) => {
    console.error(`[provider-sync:background] Job ${job?.id} failed:`, err.message);
  });

  return { priorityWorker, backgroundWorker };
}
