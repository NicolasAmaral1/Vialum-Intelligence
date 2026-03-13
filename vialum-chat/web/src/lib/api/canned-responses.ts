import { apiClient, accountPath, toQueryString } from './client';
import type { CannedResponse } from '@/types/api';

export const cannedResponsesApi = {
  list: (accountId: string, params: { search?: string } = {}) =>
    apiClient<{ data: CannedResponse[] }>(accountPath(accountId, `canned-responses${toQueryString(params as Record<string, unknown>)}`)),

  searchByShortCode: (accountId: string, shortCode: string) =>
    apiClient<{ data: CannedResponse }>(accountPath(accountId, `canned-responses/search/${shortCode}`)),

  get: (accountId: string, id: string) =>
    apiClient<{ data: CannedResponse }>(accountPath(accountId, `canned-responses/${id}`)),

  create: (accountId: string, data: { shortCode: string; content: string }) =>
    apiClient<{ data: CannedResponse }>(accountPath(accountId, 'canned-responses'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<CannedResponse>) =>
    apiClient<{ data: CannedResponse }>(accountPath(accountId, `canned-responses/${id}`), { method: 'PUT', body: JSON.stringify(data) }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `canned-responses/${id}`), { method: 'DELETE' }),
};
