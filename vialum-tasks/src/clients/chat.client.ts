import { env } from '../config/env.js';
import { getServiceToken } from '../lib/service-token.js';

const BASE = env.CHAT_SERVICE_URL;

async function chatFetch(accountId: string, path: string, options: RequestInit = {}): Promise<Response> {
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

export async function sendMessage(accountId: string, params: {
  conversationId: string;
  content: string;
  contentType?: string;
}) {
  const res = await chatFetch(accountId, `/chat/api/v1/accounts/${accountId}/conversations/${params.conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: params.content,
      messageType: 'outgoing',
      contentType: params.contentType || 'text',
    }),
  });
  if (!res.ok) throw new Error(`Chat sendMessage failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function sendExternalMessage(params: {
  phone: string;
  inboxId: string;
  content: string;
  apiKey: string;
  metadata?: Record<string, string>;
}) {
  const res = await fetch(`${BASE}/chat/api/v1/external/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': params.apiKey,
    },
    body: JSON.stringify({
      phone: params.phone,
      inboxId: params.inboxId,
      content: params.content,
      mode: 'direct',
      senderLabel: 'Vialum Tasks',
      metadata: params.metadata || {},
    }),
  });
  if (!res.ok) throw new Error(`Chat sendExternalMessage failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

export async function getConversationMessages(accountId: string, conversationId: string, limit = 20) {
  const res = await chatFetch(accountId, `/chat/api/v1/accounts/${accountId}/conversations/${conversationId}/messages?limit=${limit}`);
  if (!res.ok) throw new Error(`Chat getMessages failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}
