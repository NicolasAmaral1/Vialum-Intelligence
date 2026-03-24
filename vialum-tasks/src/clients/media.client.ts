import { env } from '../config/env.js';
import { getServiceToken } from '../lib/service-token.js';

const BASE = env.MEDIA_SERVICE_URL;

async function mediaFetch(accountId: string, path: string, options: RequestInit = {}): Promise<Response> {
  const token = getServiceToken(accountId);
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function getFileUrl(accountId: string, fileId: string): Promise<string> {
  const res = await mediaFetch(accountId, `/media/api/v1/files/${fileId}/url`);
  if (!res.ok) throw new Error(`Media getFileUrl failed: ${res.status}`);
  const data = await res.json() as { data: { url: string } };
  return data.data.url;
}

export async function getFileMetadata(accountId: string, fileId: string) {
  const res = await mediaFetch(accountId, `/media/api/v1/files/${fileId}`);
  if (!res.ok) throw new Error(`Media getFileMetadata failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function listFiles(accountId: string, contextType: string, contextId: string) {
  const res = await mediaFetch(accountId, `/media/api/v1/files?contextType=${contextType}&contextId=${contextId}`);
  if (!res.ok) throw new Error(`Media listFiles failed: ${res.status}`);
  return (await res.json() as { data: unknown[] }).data;
}
