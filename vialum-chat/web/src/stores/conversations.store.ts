import { create } from 'zustand';
import type { Conversation, ConversationFilters } from '@/types/api';

interface ConversationsState {
  items: Record<string, Conversation>;
  orderedIds: string[];
  activeId: string | null;
  filters: ConversationFilters;
  total: number;
  loading: boolean;
}

interface ConversationsActions {
  setConversations: (list: Conversation[]) => void;
  upsertConversation: (conversation: Partial<Conversation> & { id: string }) => void;
  setActive: (id: string | null) => void;
  setFilters: (filters: ConversationFilters) => void;
  setLoading: (loading: boolean) => void;
  resetFilters: () => void;
  markRead: (id: string) => void;
}

const DEFAULT_FILTERS: ConversationFilters = {
  status: null,
  inboxId: null,
  labelId: null,
  assigneeId: null,
  search: '',
  page: 1,
  limit: 25,
};

function sortByActivity(items: Record<string, Conversation>): string[] {
  return Object.values(items)
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
    .map((c) => c.id);
}

export const useConversationsStore = create<ConversationsState & ConversationsActions>()((set) => ({
  items: {},
  orderedIds: [],
  activeId: null,
  filters: { ...DEFAULT_FILTERS },
  total: 0,
  loading: false,

  setConversations: (list) => {
    const items: Record<string, Conversation> = {};
    list.forEach((c) => { items[c.id] = c; });
    set({ items, orderedIds: sortByActivity(items), loading: false });
  },

  upsertConversation: (conversation) =>
    set((state) => {
      const existing = state.items[conversation.id];
      const updated = { ...existing, ...conversation } as Conversation;
      const newItems = { ...state.items, [conversation.id]: updated };
      return { items: newItems, orderedIds: sortByActivity(newItems) };
    }),

  setActive: (id) => set({ activeId: id }),

  setFilters: (filters) => set({ filters }),

  setLoading: (loading) => set({ loading }),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  markRead: (id) =>
    set((state) => {
      const conv = state.items[id];
      if (!conv) return state;
      return { items: { ...state.items, [id]: { ...conv, unreadCount: 0 } } };
    }),
}));
