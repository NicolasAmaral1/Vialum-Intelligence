import { create } from 'zustand';
import type { AISuggestion } from '@/types/api';

const MAX_CACHED_CONVERSATIONS = 20;

interface SuggestionsState {
  byConversation: Record<string, AISuggestion[]>;
  _accessOrder: string[];
  pendingTotal: number;
}

interface SuggestionsActions {
  setSuggestions: (conversationId: string, suggestions: AISuggestion[]) => void;
  addSuggestion: (conversationId: string, suggestion: Partial<AISuggestion>) => void;
  updateSuggestion: (conversationId: string, id: string, patch: Partial<AISuggestion>) => void;
  removeSuggestion: (id: string) => void;
  setPendingTotal: (total: number) => void;
  decrementPending: (count?: number) => void;
}

function touchAndEvict(
  byConversation: Record<string, AISuggestion[]>,
  accessOrder: string[],
  conversationId: string,
): { byConversation: Record<string, AISuggestion[]>; _accessOrder: string[] } {
  const newOrder = accessOrder.filter((id) => id !== conversationId);
  newOrder.push(conversationId);

  const newByConv = { ...byConversation };
  while (newOrder.length > MAX_CACHED_CONVERSATIONS) {
    const evicted = newOrder.shift()!;
    delete newByConv[evicted];
  }

  return { byConversation: newByConv, _accessOrder: newOrder };
}

export const useSuggestionsStore = create<SuggestionsState & SuggestionsActions>()((set) => ({
  byConversation: {},
  _accessOrder: [],
  pendingTotal: 0,

  setSuggestions: (conversationId, suggestions) =>
    set((s) => {
      const { byConversation, _accessOrder } = touchAndEvict(s.byConversation, s._accessOrder, conversationId);
      byConversation[conversationId] = suggestions;
      return { byConversation, _accessOrder };
    }),

  addSuggestion: (conversationId, suggestion) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      const { byConversation, _accessOrder } = touchAndEvict(s.byConversation, s._accessOrder, conversationId);
      byConversation[conversationId] = [...(byConversation[conversationId] || existing), suggestion as AISuggestion];
      return { byConversation, _accessOrder, pendingTotal: s.pendingTotal + 1 };
    }),

  updateSuggestion: (conversationId, id, patch) =>
    set((s) => {
      const suggestions = (s.byConversation[conversationId] || []).map((sug) =>
        sug.id === id ? { ...sug, ...patch } : sug,
      );
      return { byConversation: { ...s.byConversation, [conversationId]: suggestions } };
    }),

  removeSuggestion: (id) =>
    set((s) => {
      const newByConv = { ...s.byConversation };
      for (const convId in newByConv) {
        newByConv[convId] = newByConv[convId].filter((sug) => sug.id !== id);
      }
      return { byConversation: newByConv };
    }),

  setPendingTotal: (total) => set({ pendingTotal: total }),

  decrementPending: (count = 1) =>
    set((s) => ({ pendingTotal: Math.max(0, s.pendingTotal - count) })),
}));
