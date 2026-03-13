import { create } from 'zustand';
import type { AISuggestion } from '@/types/api';

interface SuggestionsState {
  byConversation: Record<string, AISuggestion[]>;
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

export const useSuggestionsStore = create<SuggestionsState & SuggestionsActions>()((set) => ({
  byConversation: {},
  pendingTotal: 0,

  setSuggestions: (conversationId, suggestions) =>
    set((s) => ({
      byConversation: { ...s.byConversation, [conversationId]: suggestions },
    })),

  addSuggestion: (conversationId, suggestion) =>
    set((s) => {
      const existing = s.byConversation[conversationId] || [];
      return {
        byConversation: {
          ...s.byConversation,
          [conversationId]: [...existing, suggestion as AISuggestion],
        },
        pendingTotal: s.pendingTotal + 1,
      };
    }),

  updateSuggestion: (conversationId, id, patch) =>
    set((s) => {
      const suggestions = (s.byConversation[conversationId] || []).map((sug) =>
        sug.id === id ? { ...sug, ...patch } : sug,
      );
      return {
        byConversation: { ...s.byConversation, [conversationId]: suggestions },
      };
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
