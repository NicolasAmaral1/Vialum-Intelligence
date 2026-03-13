import { apiClient, accountPath } from './client';
import type { AutomationRule } from '@/types/api';

export const automationApi = {
  list: (accountId: string) =>
    apiClient<{ data: AutomationRule[] }>(accountPath(accountId, 'automation-rules')),

  get: (accountId: string, id: string) =>
    apiClient<{ data: AutomationRule }>(accountPath(accountId, `automation-rules/${id}`)),

  create: (accountId: string, data: Partial<AutomationRule>) =>
    apiClient<{ data: AutomationRule }>(accountPath(accountId, 'automation-rules'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Partial<AutomationRule>) =>
    apiClient<{ data: AutomationRule }>(accountPath(accountId, `automation-rules/${id}`), { method: 'PUT', body: JSON.stringify(data) }),

  toggle: (accountId: string, id: string) =>
    apiClient<{ data: AutomationRule }>(accountPath(accountId, `automation-rules/${id}/toggle`), { method: 'POST' }),

  remove: (accountId: string, id: string) =>
    apiClient<void>(accountPath(accountId, `automation-rules/${id}`), { method: 'DELETE' }),
};
