import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { analyzeTalkMessage } from '../modules/talk-engine/engine.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// Talk Analyze Worker
// Queue: talk:analyze
// Runs engine pipeline stages [2]-[6] for a known Talk.
// Used when the routing has already been done (e.g., manual assignment).
// ════════════════════════════════════════════════════════════

export interface TalkAnalyzeJobData {
  talkId: string;
  messageId: string;
  messageContent: string;
}

export function createTalkAnalyzeWorker(io: SocketIOServer): Worker {
  const worker = new Worker<TalkAnalyzeJobData>(
    'talk-analyze',
    async (job: Job<TalkAnalyzeJobData>) => {
      const { talkId, messageId, messageContent } = job.data;

      job.log(`Analyzing message ${messageId} for talk ${talkId}`);

      const result = await analyzeTalkMessage(talkId, messageId, messageContent, io);

      job.log(
        `Analysis complete: mode=${result.decision?.mode}, stepChanged=${result.stepChanged}, completed=${result.talkCompleted}`,
      );

      return result;
    },
    {
      connection: getRedis() as any,
      concurrency: 3,
      limiter: {
        max: 20,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[talk:analyze] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[talk:analyze] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
