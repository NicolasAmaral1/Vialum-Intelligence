import { getPrisma } from '../config/database.js';
import { onStepTimeout } from '../engine/execution-engine.js';
import { broadcastToWorkflow } from '../plugins/websocket.js';

const POLL_INTERVAL_MS = 30_000; // 30 seconds
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Scheduled Job Worker
 *
 * Polls for due jobs every 30s and executes them:
 * - timeout: marks step as failed/timed out
 * - follow_up_human: creates reminder inbox item
 * - follow_up_client: sends follow-up message (future)
 */
export function startScheduledJobWorker(): void {
  console.log('[scheduled-jobs] Worker started, polling every 30s');

  // Run immediately, then on interval
  processJobs().catch(console.error);
  timer = setInterval(() => {
    processJobs().catch(console.error);
  }, POLL_INTERVAL_MS);
}

export function stopScheduledJobWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[scheduled-jobs] Worker stopped');
  }
}

async function processJobs(): Promise<void> {
  const prisma = getPrisma();

  // Find due jobs that haven't been executed or cancelled
  const dueJobs = await prisma.scheduledJob.findMany({
    where: {
      scheduledAt: { lte: new Date() },
      executedAt: null,
      cancelledAt: null,
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20, // batch limit
  });

  if (dueJobs.length === 0) return;

  console.log(`[scheduled-jobs] Processing ${dueJobs.length} due jobs`);

  for (const job of dueJobs) {
    try {
      await executeJob(job);

      // Mark as executed
      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: { executedAt: new Date() },
      });
    } catch (err) {
      console.error(`[scheduled-jobs] Job ${job.id} failed:`, (err as Error).message);
    }
  }
}

async function executeJob(job: {
  id: string;
  type: string;
  stepId: string;
  workflowId: string;
  accountId: string;
  payload: unknown;
}): Promise<void> {
  const prisma = getPrisma();
  const payload = (job.payload ?? {}) as Record<string, unknown>;

  switch (job.type) {
    case 'timeout': {
      console.log(`[scheduled-jobs] Timeout for step ${job.stepId}`);
      await onStepTimeout(job.stepId);
      broadcastToWorkflow(job.workflowId, 'step:failed', {
        workflowId: job.workflowId,
        stepId: job.stepId,
        error: 'Step timed out',
      });
      break;
    }

    case 'follow_up_human': {
      console.log(`[scheduled-jobs] Follow-up reminder for step ${job.stepId}`);

      // Check if step is still awaiting
      const step = await prisma.workflowStep.findUnique({ where: { id: job.stepId } });
      if (!step || step.status !== 'awaiting_human') return;

      // Check if inbox item still pending
      const inboxItem = await prisma.inboxItem.findFirst({
        where: { stepId: job.stepId, status: 'pending' },
      });
      if (!inboxItem) return;

      // Update inbox item priority based on attempt number
      const attempt = (payload.attemptNumber as number) || 1;
      const newPriority = attempt >= 3 ? 'urgent' : attempt >= 2 ? 'high' : 'normal';

      await prisma.inboxItem.update({
        where: { id: inboxItem.id },
        data: { priority: newPriority },
      });

      // Broadcast reminder
      broadcastToWorkflow(job.workflowId, 'inbox:reminder', {
        workflowId: job.workflowId,
        stepId: job.stepId,
        inboxItemId: inboxItem.id,
        attempt,
        message: (payload.message as string) || 'Lembrete: item pendente no inbox',
      });

      // Escalate if last attempt
      if (payload.escalateTo) {
        await prisma.inboxItem.update({
          where: { id: inboxItem.id },
          data: {
            assigneeRole: payload.escalateTo as string,
            priority: 'urgent',
          },
        });
        console.log(`[scheduled-jobs] Escalated to ${payload.escalateTo}`);
      }

      break;
    }

    case 'follow_up_client': {
      console.log(`[scheduled-jobs] Client follow-up for step ${job.stepId} (not implemented)`);
      // Future: call Chat API to send follow-up WhatsApp message
      break;
    }

    default:
      console.warn(`[scheduled-jobs] Unknown job type: ${job.type}`);
  }
}
