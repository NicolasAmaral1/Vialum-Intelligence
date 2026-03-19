import { apiClient, accountPath } from './client';
import type { TeamMember } from '@/types/api';

export const usersApi = {
  list: (accountId: string) =>
    apiClient<{ data: TeamMember[] }>(accountPath(accountId, 'users')),

  create: (accountId: string, data: { name: string; email: string; password: string; role?: string }) =>
    apiClient<{ data: TeamMember }>(accountPath(accountId, 'users'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, userId: string, data: { name?: string; role?: string; availability?: string }) =>
    apiClient<{ data: TeamMember }>(accountPath(accountId, `users/${userId}`), { method: 'PUT', body: JSON.stringify(data) }),

  remove: (accountId: string, userId: string) =>
    apiClient<void>(accountPath(accountId, `users/${userId}`), { method: 'DELETE' }),
};
