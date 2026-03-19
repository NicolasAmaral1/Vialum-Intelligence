// ════════════════════════════════════════════════════════════
// Media Service Client — Fetches files and updates classification
// ════════════════════════════════════════════════════════════

import { env } from '../config/env.js';
import jwt from 'jsonwebtoken';

function getServiceToken(accountId: string): string {
  return jwt.sign({ userId: 'switch-service', accountId, role: 'service' }, env.JWT_SECRET, { expiresIn: '5m' });
}

export async function getFileMetadata(accountId: string, fileId: string) {
  const token = getServiceToken(accountId);
  const res = await fetch(`${env.MEDIA_SERVICE_URL}/media/api/v1/files/${fileId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Media Service error: ${res.status}`);
  const data = await res.json() as { data: { storageKey: string; mimeType: string; filename: string } };
  return data.data;
}

export async function getPresignedUrl(accountId: string, fileId: string): Promise<string> {
  const token = getServiceToken(accountId);
  const res = await fetch(`${env.MEDIA_SERVICE_URL}/media/api/v1/files/${fileId}/url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Media Service presigned URL error: ${res.status}`);
  const data = await res.json() as { data: { url: string } };
  return data.data.url;
}

export async function downloadFile(accountId: string, fileId: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const url = await getPresignedUrl(accountId, fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`File download error: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const meta = await getFileMetadata(accountId, fileId);
  return { buffer, mimeType: meta.mimeType, filename: meta.filename };
}

export async function updateClassification(accountId: string, fileId: string, classification: Record<string, unknown>) {
  const token = getServiceToken(accountId);
  await fetch(`${env.MEDIA_SERVICE_URL}/media/api/v1/files/${fileId}/classification`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(classification),
  });
}
