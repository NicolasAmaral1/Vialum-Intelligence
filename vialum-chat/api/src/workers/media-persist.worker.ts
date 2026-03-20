import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { getEnv } from '../config/env.js';
import crypto from 'node:crypto';

// ════════════════════════════════════════════════════════════
// Media Persist Worker
// Queue: media-persist
// Downloads WhatsApp media via Media Service and updates
// the message's contentAttributes with the permanent fileId.
//
// Flow:
// 1. Receive job with messageId + media params
// 2. Call Media Service POST /files/from-whatsapp
// 3. Update message contentAttributes with mediaFileId
// 4. Cache fileId→messageId mapping in Redis (for Switch callback)
// ════════════════════════════════════════════════════════════

export interface MediaPersistJobData {
  messageId: string;
  conversationId: string;
  accountId: string;
  inboxId: string;
  provider: string;
  contentType: string;
  // Evolution API
  mediaUrl?: string;
  // Cloud API
  mediaId?: string;
  accessToken?: string;
  // Provider config (for Evolution instance params)
  instanceName?: string;
  instanceBaseUrl?: string;
  // File metadata
  mimeType?: string;
  fileName?: string;
}

function generateServiceToken(accountId: string): string {
  const env = getEnv();
  const secret = env.MEDIA_JWT_SECRET;
  if (!secret) throw new Error('MEDIA_JWT_SECRET not configured');

  // Build JWT manually (HS256) to avoid adding jsonwebtoken dependency
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    userId: 'system', accountId, role: 'admin',
    iat: now, exp: now + 300, // 5 min
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function createMediaPersistWorker(): Worker {
  const worker = new Worker<MediaPersistJobData>(
    'media-persist',
    async (job: Job<MediaPersistJobData>) => {
      const prisma = getPrisma();
      const redis = getRedis();
      const env = getEnv();
      const { messageId, conversationId, accountId, provider, contentType } = job.data;

      job.log(`Persisting media for message ${messageId} (${contentType})`);

      // Idempotency: check if already processed
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, contentAttributes: true },
      });

      if (!message) {
        job.log(`Message ${messageId} not found, skipping`);
        return { skipped: true, reason: 'message_not_found' };
      }

      const attrs = message.contentAttributes as Record<string, unknown>;
      if (attrs?.mediaFileId) {
        job.log(`Message ${messageId} already has mediaFileId, skipping`);
        return { skipped: true, reason: 'already_persisted' };
      }

      // Build request to Media Service
      const body: Record<string, unknown> = {
        provider,
        context_type: 'message',
        context_id: messageId,
        mimeType: job.data.mimeType,
        filename: job.data.fileName,
        tags: ['whatsapp', contentType],
      };

      if (provider === 'evolution_api') {
        body.mediaUrl = job.data.mediaUrl;
        body.instanceName = job.data.instanceName;
        body.instanceBaseUrl = job.data.instanceBaseUrl;
      } else if (provider === 'cloud_api') {
        body.mediaId = job.data.mediaId;
        body.accessToken = job.data.accessToken;
      }

      // Call Media Service
      const token = generateServiceToken(accountId);
      const mediaUrl = `${env.MEDIA_SERVICE_URL}/api/v1/files/from-whatsapp`;

      const response = await fetch(mediaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Media Service error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as { data: { id: string; s3Key: string; mimeType: string; size: number } };
      const mediaFileId = result.data.id;

      job.log(`Media persisted: fileId=${mediaFileId}`);

      // Update message contentAttributes with permanent file reference
      await prisma.message.update({
        where: { id: messageId },
        data: {
          contentAttributes: {
            ...attrs,
            mediaFileId,
            mediaSize: result.data.size,
            mediaMimeType: result.data.mimeType,
          } as any,
        },
      });

      // Cache fileId→messageId mapping for Switch callback (24h TTL)
      await redis.set(
        `media:file:${mediaFileId}`,
        JSON.stringify({ messageId, conversationId, contentType }),
        'EX',
        86400,
      );

      job.log(`Message ${messageId} updated with mediaFileId ${mediaFileId}`);
      return { messageId, mediaFileId };
    },
    {
      connection: getRedis() as any,
      concurrency: 5,
      limiter: { max: 50, duration: 1000 },
    },
  );

  worker.on('completed', (job) => {
    console.log(`[media:persist] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[media:persist] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
