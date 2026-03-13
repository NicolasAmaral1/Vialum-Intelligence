import { apiClient, accountPath, toQueryString } from './client';
import type { Objection } from '@/types/api';

export const objectionsApi = {
  list: (accountId: string, params: { category?: string; limit?: number; offset?: number } = {}) =>
    apiClient<{ data: Objection[] }>(accountPath(accountId, `objections${toQueryString(params as Record<string, unknown>)}`)),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Objection }>(accountPath(accountId, `objections/${id}`)),

  create: (accountId: string, data: Partial<Objection>) =>
    apiClient<{ data: Objection }>(accountPath(accountId, 'objections'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<Objection>) =>
    apiClient<{ data: Objection }>(accountPath(accountId, `objections/${id}`), { method: 'PATCH', body: JSON.stringify(data) }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `objections/${id}`), { method: 'DELETE' }),
};
