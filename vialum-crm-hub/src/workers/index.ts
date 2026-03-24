import { Worker } from 'bullmq';
import { createProviderSyncWorkers } from './provider-sync.worker.js';
import { createProactiveSyncWorker, scheduleProactiveSync } from './proactive-sync.worker.js';

interface WorkerRegistry {
  prioritySync: Worker;
  backgroundSync: Worker;
  proactiveSync: Worker;
}

let registry: WorkerRegistry | null = null;

export async function initializeWorkers(): Promise<WorkerRegistry> {
  console.log('[hub:workers] Initializing workers...');

  const { priorityWorker, backgroundWorker } = createProviderSyncWorkers();
  const proactiveSync = createProactiveSyncWorker();

  await scheduleProactiveSync();

  registry = {
    prioritySync: priorityWorker,
    backgroundSync: backgroundWorker,
    proactiveSync,
  };

  console.log('[hub:workers] Active queues:');
  console.log('  - provider-sync-priority (concurrency: 5)');
  console.log('  - provider-sync-background (concurrency: 10)');
  console.log('  - proactive-sync-cron (every 30min)');

  return registry;
}

export async function shutdownWorkers(): Promise<void> {
  if (!registry) return;
  console.log('[hub:workers] Shutting down workers...');
  await Promise.allSettled([
    registry.prioritySync.close(),
    registry.backgroundSync.close(),
    registry.proactiveSync.close(),
  ]);
  console.log('[hub:workers] Workers shut down');
}
