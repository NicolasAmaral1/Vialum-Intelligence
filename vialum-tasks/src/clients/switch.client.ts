import { env } from '../config/env.js';
import { getServiceToken } from '../lib/service-token.js';

const BASE = env.SWITCH_SERVICE_URL;

async function switchFetch(accountId: string, path: string, options: RequestInit = {}): Promise<Response> {
  const token = getServiceToken(accountId);
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
}

export async function processFile(accountId: string, params: {
  processor: string;
  fileId?: string;
  fileUrl?: string;
  text?: string;
  processorParams?: Record<string, unknown>;
}) {
  const input: Record<string, unknown> = {};
  if (params.fileId) input.fileId = params.fileId;
  else if (params.fileUrl) input.fileUrl = params.fileUrl;
  else if (params.text) input.text = params.text;

  const res = await switchFetch(accountId, '/switch/api/v1/process', {
    method: 'POST',
    body: JSON.stringify({
      processor: params.processor,
      input,
      params: params.processorParams || {},
    }),
  });
  if (!res.ok) throw new Error(`Switch processFile failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function getJobResult(accountId: string, jobId: string) {
  const res = await switchFetch(accountId, `/switch/api/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Switch getJobResult failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}
