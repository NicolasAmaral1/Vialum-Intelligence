import { apiClient, accountPath, toQueryString } from './client';
import type { AISuggestion, PaginatedResult } from '@/types/api';

export const aiSuggestionsApi = {
  list: (accountId: string, params: { status?: string; conversationId?: string; talkId?: string; page?: number; limit?: number } = {}) =>
    apiClient<PaginatedResult<AISuggestion>>(accountPath(accountId, `ai-suggestions${toQueryString(params as Record<string, unknown>)}`)),

  update: (accountId: string, id: string, data: { status: string; editedContent?: string }) =>
    apiClient<{ data: AISuggestion }>(accountPath(accountId, `ai-suggestions/${id}`), {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  bulkUpdate: (accountId: string, ids: string[], status: string) =>
    apiClient<{ data: { updated: number } }>(accountPath(accountId, 'ai-suggestions/bulk'), {
      method: 'POST',
      body: JSON.stringify({ ids, status }),
    }),
};
