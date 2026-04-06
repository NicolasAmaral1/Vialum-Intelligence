import { create } from 'zustand';
import type { Message } from '@/types/api';

const MAX_CACHED_CONVERSATIONS = 20;

interface MessagesState {
  byConversation: Record<string, Message[]>;
  _accessOrder: string[]; // LRU tracking
}

interface MessagesActions {
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  optimisticAdd: (conversationId: string, msg: Message) => void;
  confirmOptimistic: (conversationId: string, tempId: string, real: Message) => void;
  failOptimistic: (conversationId: string, tempId: string) => void;
}

/** Move conversationId to end of access order and evict oldest if over limit */
function touchAndEvict(
  byConversation: Record<string, Message[]>,
  accessOrder: string[],
  conversationId: string,
): { byConversation: Record<string, Message[]>; _accessOrder: string[] } {
  const newOrder = accessOrder.filter((id) => id !== conversationId);
  newOrder.push(conversationId);

  const newByConv = { ...byConversation };
  while (newOrder.length > MAX_CACHED_CONVERSATIONS) {
    const evicted = newOrder.shift()!;
    delete newByConv[evicted];
  }

  return { byConversation: newByConv, _accessOrder: newOrder };
}

export const useMessagesStore = create<MessagesState & MessagesActions>()((set) => ({
  byConversation: {},
  _accessOrder: [],

  setMessages: (conversationId, messages) =>
    set((s) => {
      const { byConversation, _accessOrder } = touchAndEvict(s.byConversation, s._accessOrder, conversationId);
      byConversation[conversationId] = messages;
      return { byConversation, _accessOrder };
    }),

  addMessage: (conversationId, message) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      const { byConversation, _accessOrder } = touchAndEvict(s.byConversation, s._accessOrder, conversationId);
      byConversation[conversationId] = [...(byConversation[conversationId] || existing), message];
      return { byConversation, _accessOrder };
    }),

  optimisticAdd: (conversationId, msg) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      const { byConversation, _accessOrder } = touchAndEvict(s.byConversation, s._accessOrder, conversationId);
      byConversation[conversationId] = [...(byConversation[conversationId] || existing), msg];
      return { byConversation, _accessOrder };
    }),

  confirmOptimistic: (conversationId, tempId, real) =>
    set((s) => {
      const msgs = (s.byConversation[conversationId] || []).map((m) =>
        m._tempId === tempId ? { ...real, _optimistic: false } : m,
      );
      return { byConversation: { ...s.byConversation, [conversationId]: msgs } };
    }),

  failOptimistic: (conversationId, tempId) =>
    set((s) => {
      const msgs = (s.byConversation[conversationId] || []).map((m) =>
        m._tempId === tempId ? { ...m, status: 'failed' as const, _optimistic: false } : m,
      );
      return { byConversation: { ...s.byConversation, [conversationId]: msgs } };
    }),
}));
