import { apiClient, accountPath, toQueryString } from './client';
import type { Conversation, ConversationFilters, PaginatedResult } from '@/types/api';

export const conversationsApi = {
  list: (accountId: string, filters: ConversationFilters = {}) =>
    apiClient<PaginatedResult<Conversation>>(
      accountPath(accountId, `conversations${toQueryString(filters as Record<string, unknown>)}`),
    ),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Conversation }>(accountPath(accountId, `conversations/${id}`)),

  create: (accountId: string, data: Record<string, unknown>) =>
    apiClient<{ data: Conversation }>(accountPath(accountId, 'conversations'), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (accountId: string, id: string, data: Record<string, unknown>) =>
    apiClient<{ data: Conversation }>(accountPath(accountId, `conversations/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  resolve: (accountId: string, id: string) =>
    apiClient<{ data: Conversation }>(accountPath(accountId, `conversations/${id}/resolve`), {
      method: 'POST',
    }),

  reopen: (accountId: string, id: string) =>
    apiClient<{ data: Conversation }>(accountPath(accountId, `conversations/${id}/reopen`), {
      method: 'POST',
    }),

  addLabel: (accountId: string, id: string, labelId: string) =>
    apiClient<void>(accountPath(accountId, `conversations/${id}/labels`), {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    }),

  removeLabel: (accountId: string, id: string, labelId: string) =>
    apiClient<void>(accountPath(accountId, `conversations/${id}/labels/${labelId}`), {
      method: 'DELETE',
    }),
};
