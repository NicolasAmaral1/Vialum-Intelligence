import { create } from 'zustand';
import type { Message } from '@/types/api';

interface MessagesState {
  byConversation: Record<string, Message[]>;
}

interface MessagesActions {
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  optimisticAdd: (conversationId: string, msg: Message) => void;
  confirmOptimistic: (conversationId: string, tempId: string, real: Message) => void;
  failOptimistic: (conversationId: string, tempId: string) => void;
}

export const useMessagesStore = create<MessagesState & MessagesActions>()((set) => ({
  byConversation: {},

  setMessages: (conversationId, messages) =>
    set((s) => ({
      byConversation: { ...s.byConversation, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      return {
        byConversation: { ...s.byConversation, [conversationId]: [...existing, message] },
      };
    }),

  optimisticAdd: (conversationId, msg) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      return {
        byConversation: { ...s.byConversation, [conversationId]: [...existing, msg] },
      };
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
