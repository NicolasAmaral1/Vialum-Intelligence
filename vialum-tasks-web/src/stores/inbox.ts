'use client';
import { create } from 'zustand';
import { api, type InboxItem, type Workflow } from '@/lib/api';

interface InboxState {
  items: InboxItem[];
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  addItem: (item: InboxItem) => void;
  removeItem: (id: string) => void;
  completeItem: (id: string, outputData: Record<string, unknown>) => Promise<void>;
  updateWorkflow: (id: string, data: Partial<Workflow>) => void;
}

export const useInbox = create<InboxState>((set, get) => ({
  items: [],
  workflows: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const [inboxRes, workflowsRes] = await Promise.all([
        api.getInbox('status=pending'),
        api.getWorkflows('limit=50'),
      ]);
      set({
        items: inboxRes.data,
        workflows: workflowsRes.data,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', loading: false });
    }
  },

  addItem: (item) => {
    set((s) => ({
      items: [item, ...s.items.filter((i) => i.id !== item.id)],
    }));
  },

  removeItem: (id) => {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  completeItem: async (id, outputData) => {
    await api.completeInboxItem(id, outputData);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  updateWorkflow: (id, data) => {
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }));
  },
}));
