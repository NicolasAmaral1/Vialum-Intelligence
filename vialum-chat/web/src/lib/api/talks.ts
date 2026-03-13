import { apiClient, accountPath, toQueryString } from './client';
import type { Talk, TalkEvent } from '@/types/api';

export const talksApi = {
  list: (accountId: string, params: { conversationId: string; status?: string; limit?: number; offset?: number }) =>
    apiClient<{ data: Talk[] }>(accountPath(accountId, `talks${toQueryString(params as Record<string, unknown>)}`)),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Talk }>(accountPath(accountId, `talks/${id}`)),

  create: (accountId: string, data: { treeFlowId: string; contactId: string; parentTalkId?: string; metadata?: Record<string, unknown> }, conversationId: string) =>
    apiClient<{ data: Talk }>(accountPath(accountId, `talks?conversationId=${conversationId}`), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (accountId: string, id: string, data: { action: 'pause' | 'resume' | 'close' | 'change_step'; reason?: string; targetStepId?: string }) =>
    apiClient<{ data: Talk }>(accountPath(accountId, `talks/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  listEvents: (accountId: string, id: string, params: { eventType?: string; limit?: number; offset?: number } = {}) =>
    apiClient<{ data: TalkEvent[] }>(accountPath(accountId, `talks/${id}/events${toQueryString(params as Record<string, unknown>)}`)),
};
