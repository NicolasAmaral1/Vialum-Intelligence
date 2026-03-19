// ════════════════════════════════════════════════════════════
// S3 Operations — Upload, download, pre-signed URL generation
// ════════════════════════════════════════════════════════════

import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3 } from '../config/s3.js';
import { env } from '../config/env.js';
import { randomUUID } from 'crypto';

export function buildStorageKey(accountId: string, filename: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
  const uuid = randomUUID();
  return `${accountId}/${date}/${uuid}/${filename}`;
}

export async function uploadBuffer(storageKey: string, buffer: Buffer, contentType: string): Promise<{ bucket: string; key: string; size: number }> {
  const s3 = getS3();
  await s3.send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType,
  }));

  return { bucket: env.S3_BUCKET, key: storageKey, size: buffer.length };
}

export async function getPresignedUrl(storageKey: string, expiresIn: number = 3600): Promise<{ url: string; expiresAt: string }> {
  const s3 = getS3();
  const url = await getSignedUrl(s3,
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: storageKey }),
    { expiresIn },
  );

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { url, expiresAt };
}

export async function deleteObject(storageKey: string): Promise<void> {
  const s3 = getS3();
  await s3.send(new DeleteObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: storageKey,
  }));
}

export async function headObject(storageKey: string): Promise<{ contentType?: string; contentLength?: number } | null> {
  const s3 = getS3();
  try {
    const result = await s3.send(new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: storageKey,
    }));
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
    };
  } catch {
    return null;
  }
}

export async function downloadFromUrl(url: string, headers?: Record<string, string>): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
  const response = await fetch(url, {
    headers: headers ?? {},
  });

  if (!response.ok) {
    throw new Error(`Failed to download from ${url}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

  // Try to extract filename from URL or content-disposition
  let filename = 'download';
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    const match = disposition.match(/filename="?([^";\s]+)"?/);
    if (match) filename = match[1];
  } else {
    const urlPath = new URL(url).pathname;
    const parts = urlPath.split('/');
    const last = parts[parts.length - 1];
    if (last && last.includes('.')) filename = last;
  }

  return { buffer, contentType, filename };
}
