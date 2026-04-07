// ════════════════════════════════════════════════════════════
// Files Service — Upload, download, metadata, pre-signed URLs
// ════════════════════════════════════════════════════════════

import { getPrisma } from '../../config/database.js';
import * as s3 from '../../lib/s3-operations.js';

interface CreateFileParams {
  accountId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  contextType?: string;
  contextId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  uploadedBy?: string;
}

interface CreateFromUrlParams {
  accountId: string;
  url: string;
  filename?: string;
  headers?: Record<string, string>;
  contextType?: string;
  contextId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export async function uploadFile(params: CreateFileParams) {
  const prisma = getPrisma();
  const storageKey = s3.buildStorageKey(params.accountId, params.filename);

  await s3.uploadBuffer(storageKey, params.buffer, params.mimeType);

  const file = await prisma.mediaFile.create({
    data: {
      accountId: params.accountId,
      filename: params.filename,
      mimeType: params.mimeType,
      sizeBytes: params.buffer.length,
      storageKey,
      contextType: params.contextType ?? null,
      contextId: params.contextId ?? null,
      tags: params.tags ?? [],
      metadata: (params.metadata ?? {}) as any,
      uploadedBy: params.uploadedBy ?? 'api',
    },
  });

  await emitWebhook(params.accountId, 'file.created', file);
  return file;
}

export async function uploadFromUrl(params: CreateFromUrlParams & { mimeTypeOverride?: string }) {
  const { buffer, contentType, filename: inferredFilename } = await s3.downloadFromUrl(
    params.url,
    params.headers,
  );

  // Use override if provided (e.g. WhatsApp sends octet-stream but we know the real type)
  const finalMimeType = params.mimeTypeOverride && params.mimeTypeOverride !== 'application/octet-stream'
    ? params.mimeTypeOverride
    : contentType;

  return uploadFile({
    accountId: params.accountId,
    filename: params.filename ?? inferredFilename,
    mimeType: finalMimeType,
    buffer,
    contextType: params.contextType,
    contextId: params.contextId,
    tags: params.tags,
    metadata: { ...params.metadata, sourceUrl: params.url },
    uploadedBy: 'from-url',
  });
}

export async function uploadFromWhatsApp(params: {
  accountId: string;
  provider: 'evolution_api' | 'cloud_api';
  mediaUrl?: string;
  mediaId?: string;
  accessToken?: string;
  instanceName?: string;
  instanceBaseUrl?: string;
  filename?: string;
  mimeType?: string;
  contextType?: string;
  contextId?: string;
  tags?: string[];
}) {
  let downloadUrl: string;
  let downloadHeaders: Record<string, string> = {};

  if (params.provider === 'evolution_api') {
    if (!params.mediaUrl) throw { statusCode: 400, message: 'mediaUrl required for evolution_api', code: 'MISSING_FIELD' };
    downloadUrl = params.mediaUrl;
  } else {
    // Cloud API: resolve mediaId to URL
    if (!params.mediaId || !params.accessToken) {
      throw { statusCode: 400, message: 'mediaId and accessToken required for cloud_api', code: 'MISSING_FIELD' };
    }
    const metaResponse = await fetch(`https://graph.facebook.com/v18.0/${params.mediaId}`, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!metaResponse.ok) throw new Error(`Meta API error: ${metaResponse.status}`);
    const metaData = await metaResponse.json() as { url: string };
    downloadUrl = metaData.url;
    downloadHeaders = { Authorization: `Bearer ${params.accessToken}` };
  }

  return uploadFromUrl({
    accountId: params.accountId,
    url: downloadUrl,
    filename: params.filename ?? `wa_${Date.now()}`,
    headers: downloadHeaders,
    mimeTypeOverride: params.mimeType, // WhatsApp URLs often return octet-stream
    contextType: params.contextType,
    contextId: params.contextId,
    tags: [...(params.tags ?? []), 'whatsapp', params.provider],
    metadata: {
      provider: params.provider,
      mediaId: params.mediaId,
      mediaUrl: params.mediaUrl,
    },
  });
}

export async function getFile(accountId: string, fileId: string) {
  const prisma = getPrisma();
  return prisma.mediaFile.findFirst({
    where: { id: fileId, accountId, deletedAt: null },
  });
}

export async function getPresignedUrl(accountId: string, fileId: string, expiresIn?: number) {
  const file = await getFile(accountId, fileId);
  if (!file) throw { statusCode: 404, message: 'File not found', code: 'NOT_FOUND' };
  return s3.getPresignedUrl(file.storageKey, expiresIn ?? 3600);
}

export async function listFiles(accountId: string, filters: {
  contextType?: string;
  contextId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}) {
  const prisma = getPrisma();

  const where: Record<string, unknown> = {
    accountId,
    deletedAt: null,
  };

  if (filters.contextType) where.contextType = filters.contextType;
  if (filters.contextId) where.contextId = filters.contextId;
  if (filters.tags?.length) where.tags = { hasEvery: filters.tags };

  const [files, total] = await Promise.all([
    prisma.mediaFile.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    }),
    prisma.mediaFile.count({ where: where as any }),
  ]);

  return { files, total };
}

export async function updateClassification(accountId: string, fileId: string, classification: Record<string, unknown>) {
  const prisma = getPrisma();
  return prisma.mediaFile.update({
    where: { id: fileId },
    data: { classification: classification as any },
  });
}

export async function deleteFile(accountId: string, fileId: string) {
  const prisma = getPrisma();
  // Soft delete
  return prisma.mediaFile.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });
}

// ── Webhook notification ──────────────────────────────

async function emitWebhook(accountId: string, event: string, data: unknown) {
  const prisma = getPrisma();
  const configs = await prisma.mediaWebhookConfig.findMany({
    where: { accountId, active: true, events: { has: event } },
  });

  for (const config of configs) {
    fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}),
      },
      body: JSON.stringify({ event, accountId, data, timestamp: new Date().toISOString() }),
    }).catch(() => {}); // Fire and forget
  }
}
