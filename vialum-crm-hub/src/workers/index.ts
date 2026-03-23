import { Worker } from 'bullmq';
import { createProviderSyncWorkers } from './provider-sync.worker.js';

interface WorkerRegistry {
  prioritySync: Worker;
  backgroundSync: Worker;
}

let registry: WorkerRegistry | null = null;

export async function initializeWorkers(): Promise<WorkerRegistry> {
  console.log('[hub:workers] Initializing workers...');

  const { priorityWorker, backgroundWorker } = createProviderSyncWorkers();

  registry = {
    prioritySync: priorityWorker,
    backgroundSync: backgroundWorker,
  };

  console.log('[hub:workers] Active queues:');
  console.log('  - provider-sync-priority (concurrency: 5)');
  console.log('  - provider-sync-background (concurrency: 10)');

  return registry;
}

export async function shutdownWorkers(): Promise<void> {
  if (!registry) return;
  console.log('[hub:workers] Shutting down workers...');
  await Promise.allSettled([
    registry.prioritySync.close(),
    registry.backgroundSync.close(),
  ]);
  console.log('[hub:workers] Workers shut down');
}
