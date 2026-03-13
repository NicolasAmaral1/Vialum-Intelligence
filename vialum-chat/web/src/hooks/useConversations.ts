'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { conversationsApi } from '@/lib/api/conversations';
import type { ConversationFilters } from '@/types/api';

export function useConversations() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { items, orderedIds, filters, loading, setLoading, setConversations, setFilters } =
    useConversationsStore();

  const fetch = useCallback(
    async (f?: ConversationFilters) => {
      if (!currentAccount) return;
      setLoading(true);
      try {
        const result = await conversationsApi.list(currentAccount.accountId, f || filters);
        setConversations(result.data);
      } catch (err) {
        console.error('Failed to fetch conversations', err);
      } finally {
        setLoading(false);
      }
    },
    [currentAccount, filters, setLoading, setConversations]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateFilters = useCallback(
    (partial: Partial<ConversationFilters>) => {
      const next = { ...filters, ...partial, page: partial.page ?? 1 };
      setFilters(next);
    },
    [filters, setFilters]
  );

  return {
    conversations: orderedIds.map((id) => items[id]).filter(Boolean),
    loading,
    filters,
    updateFilters,
    refresh: fetch,
  };
}
