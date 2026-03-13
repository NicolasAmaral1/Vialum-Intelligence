import { apiClient, accountPath, toQueryString } from './client';
import type { Contact, PaginatedResult } from '@/types/api';

export const contactsApi = {
  list: (accountId: string, params: { search?: string; page?: number; limit?: number } = {}) =>
    apiClient<PaginatedResult<Contact>>(accountPath(accountId, `contacts${toQueryString(params as Record<string, unknown>)}`)),

  get: (accountId: string, id: string) =>
    apiClient<{ data: Contact }>(accountPath(accountId, `contacts/${id}`)),

  create: (accountId: string, data: Partial<Contact>) =>
    apiClient<{ data: Contact }>(accountPath(accountId, 'contacts'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<Contact>) =>
    apiClient<{ data: Contact }>(accountPath(accountId, `contacts/${id}`), { method: 'PUT', body: JSON.stringify(data) }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `contacts/${id}`), { method: 'DELETE' }),
};
