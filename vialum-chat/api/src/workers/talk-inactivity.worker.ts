import { Worker, Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// Talk Inactivity Worker
// Queue: talk:inactivity-check
// Cron job: finds talks where last_activity_at + timeout < now
// and closes them with reason 'inactivity'.
// ════════════════════════════════════════════════════════════

export interface InactivityJobData {
  triggeredAt: string;
}

export function createTalkInactivityWorker(io: SocketIOServer): Worker {
  const worker = new Worker<InactivityJobData>(
    'talk-inactivity-check',
    async (job) => {
      const prisma = getPrisma();

      job.log('Checking for inactive talks...');

      // Find only expired active talks (filter in SQL, not JS)
      const now = new Date();
      const inactiveTalks = await prisma.$queryRaw<Array<{
        id: string;
        accountId: string;
        conversationId: string;
        parentTalkId: string | null;
        lastActivityAt: Date;
        inactivityTimeoutMinutes: number;
      }>>`
        SELECT id, account_id AS "accountId", conversation_id AS "conversationId",
               parent_talk_id AS "parentTalkId", last_activity_at AS "lastActivityAt",
               inactivity_timeout_minutes AS "inactivityTimeoutMinutes"
        FROM "Talk"
        WHERE status = 'active'
          AND last_activity_at + make_interval(mins => inactivity_timeout_minutes) < ${now}
      `;

      let closedCount = 0;

      for (const talk of inactiveTalks) {

        job.log(`Closing inactive talk ${talk.id} (last activity: ${talk.lastActivityAt.toISOString()})`);

        try {
          // Close the talk
          await prisma.$transaction(async (tx) => {
            // Snapshot TalkFlow
            const talkFlow = await tx.talkFlow.findUnique({
              where: { talkId: talk.id },
            });

            if (talkFlow) {
              await tx.talkFlow.update({
                where: { id: talkFlow.id },
                data: {
                  snapshot: {
                    state: talkFlow.state,
                    currentStepId: talkFlow.currentStepId,
                    objectionsEncountered: talkFlow.objectionsEncountered,
                    escapeAttempts: talkFlow.escapeAttempts,
                    closedAt: now.toISOString(),
                    closeReason: 'inactivity',
                  },
                },
              });
            }

            await tx.talk.update({
              where: { id: talk.id },
              data: {
                status: 'closed_inactivity',
                closedAt: now,
              },
            });

            // Clear active talk from conversation
            await tx.conversation.updateMany({
              where: { id: talk.conversationId, activeTalkId: talk.id },
              data: { activeTalkId: null, updatedAt: new Date() },
            });

            await tx.talkEvent.create({
              data: {
                talkId: talk.id,
                eventType: 'talk_closed',
                data: {
                  reason: 'inactivity',
                  status: 'closed_inactivity',
                  timeout_minutes: talk.inactivityTimeoutMinutes,
                  last_activity_at: talk.lastActivityAt.toISOString(),
                },
                actorType: 'system',
              },
            });

            // Resume parent talk if exists
            if (talk.parentTalkId) {
              const parentTalk = await tx.talk.findFirst({
                where: { id: talk.parentTalkId, status: 'paused' },
              });

              if (parentTalk) {
                await tx.talk.update({
                  where: { id: parentTalk.id },
                  data: { status: 'active', resumedAt: now, lastActivityAt: now },
                });

                await tx.conversation.update({
                  where: { id: parentTalk.conversationId },
                  data: { activeTalkId: parentTalk.id },
                });

                await tx.talkEvent.create({
                  data: {
                    talkId: parentTalk.id,
                    eventType: 'talk_resumed',
                    data: { reason: 'sub_talk_closed_inactivity', subTalkId: talk.id },
                    actorType: 'system',
                  },
                });
              }
            }
          });

          // Emit WebSocket
          io.to(`conversation:${talk.conversationId}`).emit('talk:closed', {
            talkId: talk.id,
            conversationId: talk.conversationId,
            reason: 'inactivity',
          });

          closedCount++;
        } catch (err) {
          console.error(`[talk:inactivity] Failed to close talk ${talk.id}:`, err);
        }
      }

      job.log(`Inactivity check complete. Closed ${closedCount} talks.`);
      return { closedCount, checkedCount: inactiveTalks.length };
    },
    {
      connection: getRedis() as any,
      concurrency: 1,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[talk:inactivity-check] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[talk:inactivity-check] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

/**
 * Sets up the repeating cron job for inactivity checks.
 * Call this once at startup.
 */
export async function scheduleInactivityChecks(): Promise<void> {
  const queue = new Queue('talk-inactivity-check', { connection: getRedis() as any });

  // Remove existing repeatable jobs
  const existing = await queue.getRepeatableJobs();
  for (const job of existing) {
    await queue.removeRepeatableByKey(job.key);
  }

  // Schedule every 5 minutes
  await queue.add(
    'check-inactivity',
    { triggeredAt: new Date().toISOString() },
    {
      repeat: { pattern: '*/5 * * * *' },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 50 },
    },
  );

  await queue.close();
  console.log('[talk:inactivity-check] Scheduled repeating job every 5 minutes');
}
