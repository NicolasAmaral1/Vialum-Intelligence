import { apiClient, accountPath } from './client';
import type { Label } from '@/types/api';

export const labelsApi = {
  list: (accountId: string) =>
    apiClient<{ data: Label[] }>(accountPath(accountId, 'labels')),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Label }>(accountPath(accountId, `labels/${id}`)),

  create: (accountId: string, data: { name: string; color?: string; description?: string }) =>
    apiClient<{ data: Label }>(accountPath(accountId, 'labels'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<Label>) =>
    apiClient<{ data: Label }>(accountPath(accountId, `labels/${id}`), { method: 'PUT', body: JSON.stringify(data) }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `labels/${id}`), { method: 'DELETE' }),
};
