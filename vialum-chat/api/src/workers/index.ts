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

  // Redis memory monitor (every 5 min)
  const redis = (await import('../config/redis.js')).getRedis();
  setInterval(async () => {
    try {
      const info = await redis.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);
      if (usedMatch && maxMatch) {
        const used = parseInt(usedMatch[1], 10);
        const max = parseInt(maxMatch[1], 10);
        if (max > 0) {
          const pct = Math.round((used / max) * 100);
          if (pct > 80) {
            console.warn(`[redis:alert] Memory usage at ${pct}% (${Math.round(used / 1024 / 1024)}MB / ${Math.round(max / 1024 / 1024)}MB)`);
          }
        }
      }
    } catch { /* non-critical */ }
  }, 5 * 60 * 1000);

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
