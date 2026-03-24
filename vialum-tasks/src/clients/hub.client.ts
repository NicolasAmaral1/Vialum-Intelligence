import { env } from '../config/env.js';
import { getServiceToken } from '../lib/service-token.js';

const BASE = env.HUB_SERVICE_URL;

async function hubFetch(accountId: string, path: string, options: RequestInit = {}): Promise<Response> {
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

export async function createTask(accountId: string, params: {
  name: string;
  description?: string;
  status?: string;
  tags?: string[];
  customFields?: Array<{ key: string; value: string }>;
  listId?: string;
}) {
  const res = await hubFetch(accountId, '/crm/api/v1/tasks/', {
    method: 'POST',
    body: JSON.stringify({
      ...params,
      providerParams: params.listId ? { listId: params.listId } : undefined,
      caller: 'vialum-tasks',
    }),
  });
  if (!res.ok) throw new Error(`Hub createTask failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function updateTaskStatus(accountId: string, taskId: string, status: string) {
  const res = await hubFetch(accountId, `/crm/api/v1/tasks/${taskId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, caller: 'vialum-tasks' }),
  });
  if (!res.ok) throw new Error(`Hub updateTaskStatus failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function addComment(accountId: string, taskId: string, text: string) {
  const res = await hubFetch(accountId, `/crm/api/v1/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text, caller: 'vialum-tasks' }),
  });
  if (!res.ok) throw new Error(`Hub addComment failed: ${res.status}`);
}

export async function addTag(accountId: string, taskId: string, tag: string) {
  const res = await hubFetch(accountId, `/crm/api/v1/tasks/${taskId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ tag, caller: 'vialum-tasks' }),
  });
  if (!res.ok) throw new Error(`Hub addTag failed: ${res.status}`);
}

export async function setField(accountId: string, taskId: string, fieldKey: string, value: string) {
  const res = await hubFetch(accountId, `/crm/api/v1/tasks/${taskId}/fields/${fieldKey}`, {
    method: 'PUT',
    body: JSON.stringify({ value, caller: 'vialum-tasks' }),
  });
  if (!res.ok) throw new Error(`Hub setField failed: ${res.status}`);
}

export async function ensureContact(accountId: string, params: {
  phone: string;
  name?: string;
  email?: string;
}) {
  const res = await hubFetch(accountId, '/crm/api/v1/contacts/ensure', {
    method: 'POST',
    body: JSON.stringify({ ...params, source: 'vialum_tasks' }),
  });
  if (!res.ok) throw new Error(`Hub ensureContact failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}
