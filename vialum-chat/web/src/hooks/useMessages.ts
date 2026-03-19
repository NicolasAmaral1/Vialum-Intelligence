'use client';

import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useMessagesStore } from '@/stores/messages.store';
import { messagesApi } from '@/lib/api/messages';
import { getSocket } from '@/lib/socket/client';

export function useMessages(conversationId: string | null) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const messages = useMessagesStore((s) =>
    conversationId ? s.byConversation[conversationId] || [] : []
  );
  const { setMessages, optimisticAdd, confirmOptimistic, failOptimistic } =
    useMessagesStore();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchMessages = useCallback(
    async (beforeId?: string) => {
      if (!currentAccount || !conversationId) return;
      setLoading(true);
      try {
        const result = await messagesApi.list(currentAccount.accountId, conversationId, {
          before_id: beforeId,
          limit: 30,
        });
        if (beforeId) {
          // Older messages prepended (API returns chronological order)
          setMessages(conversationId, [
            ...result.data,
            ...(useMessagesStore.getState().byConversation[conversationId] || []),
          ]);
        } else {
          setMessages(conversationId, result.data);
        }
        setHasMore(result.data.length === 30);
      } catch (err) {
        console.error('Failed to fetch messages', err);
      } finally {
        setLoading(false);
      }
    },
    [currentAccount, conversationId, setMessages]
  );

  useEffect(() => {
    if (!conversationId) return;
    fetchMessages();

    const socket = getSocket();
    if (socket) {
      socket.emit('subscribe:conversation', conversationId);
      return () => {
        socket.emit('unsubscribe:conversation', conversationId);
      };
    }
  }, [conversationId, fetchMessages]);

  const sendMessage = useCallback(
    async (content: string, isPrivate = false) => {
      if (!currentAccount || !conversationId) return;

      const tempId = `temp_${Date.now()}`;
      optimisticAdd(conversationId, {
        id: tempId,
        _tempId: tempId,
        _optimistic: true,
        accountId: currentAccount.accountId,
        conversationId,
        inboxId: '',
        senderType: 'user',
        senderId: null,
        senderContactId: null,
        content,
        messageType: 'outgoing',
        contentType: 'text',
        contentAttributes: {},
        status: 'sending',
        private: isPrivate,
        externalMessageId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      try {
        const result = await messagesApi.create(currentAccount.accountId, conversationId, {
          content,
          messageType: 'outgoing',
          contentType: 'text',
          private: isPrivate,
        });
        confirmOptimistic(conversationId, tempId, result.data);
      } catch {
        failOptimistic(conversationId, tempId);
      }
    },
    [currentAccount, conversationId, optimisticAdd, confirmOptimistic, failOptimistic]
  );

  const loadMore = useCallback(() => {
    if (!hasMore || loading || messages.length === 0) return;
    fetchMessages(messages[0]?.id);
  }, [hasMore, loading, messages, fetchMessages]);

  return { messages, loading, hasMore, sendMessage, loadMore };
}
