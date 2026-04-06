import { apiClient, accountPath } from './client';

export const mediaApi = {
  getUrl: (accountId: string, conversationId: string, messageId: string) =>
    apiClient<{ data: { url: string; expiresAt: string } }>(
      accountPath(accountId, `conversations/${conversationId}/messages/${messageId}/media-url`),
    ),
};
