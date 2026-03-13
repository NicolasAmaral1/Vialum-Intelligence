import { apiClient, accountPath, toQueryString } from './client';
import type { Message } from '@/types/api';

export const messagesApi = {
  list: (accountId: string, conversationId: string, params: { before_id?: string; limit?: number } = {}) =>
    apiClient<{ data: Message[] }>(
      accountPath(accountId, `conversations/${conversationId}/messages${toQueryString(params as Record<string, unknown>)}`),
    ),

  create: (accountId: string, conversationId: string, data: { content: string; messageType?: string; contentType?: string; private?: boolean }) =>
    apiClient<{ data: Message }>(
      accountPath(accountId, `conversations/${conversationId}/messages`),
      { method: 'POST', body: JSON.stringify(data) },
    ),
};
