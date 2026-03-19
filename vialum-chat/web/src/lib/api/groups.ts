import { apiClient, accountPath } from './client';
import type { Group } from '@/types/api';

export interface GroupMember {
  id: string;
  groupId: string;
  contactId: string;
  role: string;
  joinedAt: string;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    avatarUrl: string | null;
  };
}

export interface GroupDetail extends Group {
  inbox?: { id: string; name: string; provider: string };
  members: GroupMember[];
}

export const groupsApi = {
  get: (accountId: string, groupId: string) =>
    apiClient<{ data: GroupDetail }>(accountPath(accountId, `groups/${groupId}`)),

  sync: (accountId: string, groupId: string) =>
    apiClient<{ data: unknown }>(accountPath(accountId, `groups/${groupId}/sync`), {
      method: 'POST',
    }),
};
