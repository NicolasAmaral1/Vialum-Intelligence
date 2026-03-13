import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { processIncomingMessage } from '../modules/talk-engine/engine.js';
import { EngineContext } from '../modules/treeflow/treeflow.types.js';
import { Server as SocketIOServer } from 'socket.io';

// ════════════════════════════════════════════════════════════
// Talk Route Worker
// Queue: talk:route-message
// Picks up incoming messages and routes them through the
// full 6-stage engine pipeline.
// ════════════════════════════════════════════════════════════

export interface TalkRouteJobData {
  accountId: string;
  conversationId: string;
  messageId: string;
  messageContent: string;
  messageSenderType: string;
}

export function createTalkRouteWorker(io: SocketIOServer): Worker {
  const worker = new Worker<TalkRouteJobData>(
    'talk-route-message',
    async (job: Job<TalkRouteJobData>) => {
      const { accountId, conversationId, messageId, messageContent, messageSenderType } = job.data;

      job.log(`Processing incoming message ${messageId} for conversation ${conversationId}`);

      // Only process incoming messages (from contacts)
      if (messageSenderType !== 'contact') {
        job.log('Skipping non-contact message');
        return { skipped: true, reason: 'not_contact_message' };
      }

      const context: EngineContext = {
        talkId: '', // Will be determined by the router
        accountId,
        conversationId,
        messageId,
        messageContent: messageContent ?? '',
        messageSenderType,
      };

      const result = await processIncomingMessage(context, io);

      job.log(
        result.routed
          ? `Routed to talk ${result.talkId} (confidence: ${result.routingConfidence}, mode: ${result.decision?.mode})`
          : 'No active talk found, message not routed',
      );

      return result;
    },
    {
      connection: getRedis() as any,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 1000,
      },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[talk:route-message] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[talk:route-message] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
