import { Server as SocketIOServer } from 'socket.io';
import { createTalkRouteWorker } from './talk-route.worker.js';
import { createTalkAnalyzeWorker } from './talk-analyze.worker.js';
import { createTalkInactivityWorker, scheduleInactivityChecks } from './talk-inactivity.worker.js';
import { createMessageSendWorker } from './message-send.worker.js';
import { createWebhookProcessWorker } from './webhook-process.worker.js';
import { createAutomationWorker } from './automation.worker.js';
import { createSnoozeWorker, scheduleSnoozeChecks } from './snooze.worker.js';
import { createMediaPersistWorker } from './media-persist.worker.js';
import { Worker } from 'bullmq';

// ════════════════════════════════════════════════════════════
// Worker Initializer
// Creates all BullMQ workers and sets up repeating jobs.
// ════════════════════════════════════════════════════════════

export interface WorkerRegistry {
  talkRoute: Worker;
  talkAnalyze: Worker;
  talkInactivity: Worker;
  messageSend: Worker;
  webhookProcess: Worker;
  automation: Worker;
  snooze: Worker;
  mediaPersist: Worker;
}

/**
 * Initializes all BullMQ workers and schedules repeating jobs.
 * Returns a registry of workers for graceful shutdown.
 */
export async function initializeWorkers(io: SocketIOServer): Promise<WorkerRegistry> {
  console.log('[workers] Initializing all workers...');

  // Create workers
  const talkRoute = createTalkRouteWorker(io);
  const talkAnalyze = createTalkAnalyzeWorker(io);
  const talkInactivity = createTalkInactivityWorker(io);
  const messageSend = createMessageSendWorker(io);
  const webhookProcess = createWebhookProcessWorker(io);
  const automation = createAutomationWorker(io);
  const snooze = createSnoozeWorker(io);
  const mediaPersist = createMediaPersistWorker();

  // Schedule repeating jobs
  await scheduleInactivityChecks();
  await scheduleSnoozeChecks();

  console.log('[workers] All workers initialized successfully');
  console.log('[workers] Active queues:');
  console.log('  - talk-route-message (concurrency: 5)');
  console.log('  - talk-analyze (concurrency: 3)');
  console.log('  - talk-inactivity-check (cron: */5 * * * *)');
  console.log('  - message-send (concurrency: 10)');
  console.log('  - webhook-process (concurrency: 10)');
  console.log('  - automation-evaluate (concurrency: 5)');
  console.log('  - conversation-snooze-check (cron: * * * * *)');
  console.log('  - media-persist (concurrency: 5)');

  return {
    talkRoute,
    talkAnalyze,
    talkInactivity,
    messageSend,
    webhookProcess,
    automation,
    snooze,
    mediaPersist,
  };
}

/**
 * Gracefully shuts down all workers.
 */
export async function shutdownWorkers(registry: WorkerRegistry): Promise<void> {
  console.log('[workers] Shutting down all workers...');

  const workers = Object.values(registry);
  await Promise.allSettled(workers.map((w) => w.close()));

  console.log('[workers] All workers shut down');
}
