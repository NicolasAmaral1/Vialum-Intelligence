import { apiClient, accountPath, toQueryString } from './client';
import type { TreeFlow, TreeFlowVersion } from '@/types/api';

export const treeflowsApi = {
  list: (accountId: string, params: { includeArchived?: boolean } = {}) =>
    apiClient<{ data: TreeFlow[] }>(accountPath(accountId, `tree-flows${toQueryString(params as Record<string, unknown>)}`)),

  get: (accountId: string, id: string) =>
    apiClient<{ data: TreeFlow }>(accountPath(accountId, `tree-flows/${id}`)),

  create: (accountId: string, data: Record<string, unknown>) =>
    apiClient<{ data: TreeFlow }>(accountPath(accountId, 'tree-flows'), { method: 'POST', body: JSON.stringify(data) }),

  update: (accountId: string, id: string, data: Record<string, unknown>) =>
    apiClient<{ data: TreeFlow }>(accountPath(accountId, `tree-flows/${id}`), { method: 'PATCH', body: JSON.stringify(data) }),

  createVersion: (accountId: string, treeFlowId: string, data: { definition: Record<string, unknown>; notes?: string }) =>
    apiClient<{ data: TreeFlowVersion }>(accountPath(accountId, `tree-flows/${treeFlowId}/versions`), {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  publishVersion: (accountId: string, treeFlowId: string, versionId: string) =>
    apiClient<{ data: TreeFlowVersion }>(accountPath(accountId, `tree-flows/${treeFlowId}/versions/${versionId}/publish`), {
      method: 'POST',
    }),
};
