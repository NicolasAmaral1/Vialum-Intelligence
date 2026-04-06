import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { getPrisma } from '../config/database.js';
import { getEnv } from '../config/env.js';
import { getWhatsAppProvider } from '../providers/factory.js';
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
  externalMessageId?: string;
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

      // Try adapter's downloadMedia first (decrypts WhatsApp media)
      const whatsappProvider = getWhatsAppProvider(provider);
      const adapterConfig = {
        base_url: job.data.instanceBaseUrl,
        api_key: job.data.accessToken,
        instance_name: job.data.instanceName,
        // Cloud API fields
        access_token: job.data.accessToken,
        phone_number_id: job.data.mediaId,
      };

      let response: Response;
      const token = generateServiceToken(accountId);

      if (whatsappProvider.downloadMedia && job.data.externalMessageId) {
        // Use adapter to download decrypted media
        const media = await whatsappProvider.downloadMedia(
          adapterConfig as Record<string, unknown>,
          job.data.externalMessageId,
        );

        if (media) {
          // Upload base64 directly to Media Service
          const buffer = Buffer.from(media.base64, 'base64');
          const boundary = `----formdata${Date.now()}`;
          const filename = job.data.fileName || `wa_${Date.now()}`;
          const mimeType = media.mimeType || job.data.mimeType || 'application/octet-stream';

          // Build multipart form data manually
          const parts: Buffer[] = [];
          // File part
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
          parts.push(buffer);
          parts.push(Buffer.from('\r\n'));
          // context_type
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="context_type"\r\n\r\nmessage\r\n`));
          // context_id
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="context_id"\r\n\r\n${messageId}\r\n`));
          // tags
          parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="tags"\r\n\r\nwhatsapp,${contentType}\r\n`));
          parts.push(Buffer.from(`--${boundary}--\r\n`));

          const bodyBuffer = Buffer.concat(parts);

          const uploadCtrl = new AbortController();
          const uploadTimeout = setTimeout(() => uploadCtrl.abort(), 30000);
          response = await fetch(`${env.MEDIA_SERVICE_URL}/api/v1/files`, {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              Authorization: `Bearer ${token}`,
              'Content-Length': String(bodyBuffer.length),
            },
            body: bodyBuffer,
            signal: uploadCtrl.signal,
          }).finally(() => clearTimeout(uploadTimeout));

          job.log(`Uploaded decrypted media (${mimeType}, ${buffer.length} bytes)`);
        } else {
          // Fallback to URL-based upload
          job.log('downloadMedia returned null, falling back to URL upload');
          response = await fallbackUrlUpload(env, token, job.data, messageId, contentType);
        }
      } else {
        // Provider doesn't support downloadMedia, use URL-based upload
        response = await fallbackUrlUpload(env, token, job.data, messageId, contentType);
      }

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
      concurrency: 2, // Reduced from 5 to limit memory usage with large media files
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

// Fallback: upload via URL (used when downloadMedia is not available)
async function fallbackUrlUpload(
  env: ReturnType<typeof getEnv>,
  token: string,
  data: MediaPersistJobData,
  messageId: string,
  contentType: string,
): Promise<Response> {
  const body: Record<string, unknown> = {
    provider: data.provider,
    context_type: 'message',
    context_id: messageId,
    mimeType: data.mimeType,
    filename: data.fileName,
    tags: ['whatsapp', contentType],
  };

  if (data.provider === 'evolution_api') {
    body.mediaUrl = data.mediaUrl;
    body.instanceName = data.instanceName;
    body.instanceBaseUrl = data.instanceBaseUrl;
  } else if (data.provider === 'cloud_api') {
    body.mediaId = data.mediaId;
    body.accessToken = data.accessToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    return await fetch(`${env.MEDIA_SERVICE_URL}/api/v1/files/from-whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
