import { env } from '../config/env.js';
import { getServiceToken } from '../lib/service-token.js';

const BASE = env.CHAT_SERVICE_URL;
const CHAT_API_KEY = process.env.CHAT_API_KEY || '';
const CHAT_INBOX_ID = process.env.CHAT_INBOX_ID || '';

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
  mode?: 'direct' | 'hitl';
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
      mode: params.mode || 'direct',
      senderLabel: 'Vialum Tasks',
      metadata: params.metadata || {},
    }),
  });
  if (!res.ok) throw new Error(`Chat sendExternalMessage failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}

/**
 * Send message to client via WhatsApp.
 * Uses configured CHAT_API_KEY and CHAT_INBOX_ID.
 * mode: 'direct' sends immediately, 'hitl' creates suggestion for human approval.
 */
export async function sendToClient(params: {
  phone: string;
  content: string;
  mode?: 'direct' | 'hitl';
  metadata?: Record<string, string>;
}) {
  if (!CHAT_API_KEY || !CHAT_INBOX_ID) {
    throw new Error('CHAT_API_KEY and CHAT_INBOX_ID must be configured');
  }

  return sendExternalMessage({
    phone: params.phone,
    inboxId: CHAT_INBOX_ID,
    content: params.content,
    apiKey: CHAT_API_KEY,
    mode: params.mode || 'direct',
    metadata: params.metadata,
  });
}

export async function getConversationMessages(accountId: string, conversationId: string, limit = 20) {
  const res = await chatFetch(accountId, `/chat/api/v1/accounts/${accountId}/conversations/${conversationId}/messages?limit=${limit}`);
  if (!res.ok) throw new Error(`Chat getMessages failed: ${res.status}`);
  return (await res.json() as { data: unknown }).data;
}
