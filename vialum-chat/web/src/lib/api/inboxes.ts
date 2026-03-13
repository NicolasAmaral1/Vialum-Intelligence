import { apiClient, accountPath } from './client';
import type { Inbox } from '@/types/api';

export const inboxesApi = {
  list: (accountId: string) =>
    apiClient<{ data: Inbox[] }>(accountPath(accountId, 'inboxes')),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Inbox }>(accountPath(accountId, `inboxes/${id}`)),

  create: (accountId: string, data: Partial<Inbox>) =>
    apiClient<{ data: Inbox }>(accountPath(accountId, 'inboxes'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<Inbox>) =>
    apiClient<{ data: Inbox }>(accountPath(accountId, `inboxes/${id}`), { method: 'PUT', body: JSON.stringify(data) }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `inboxes/${id}`), { method: 'DELETE' }),
};
