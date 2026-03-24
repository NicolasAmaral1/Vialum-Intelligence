'use client';
import { create } from 'zustand';
import { api, type Approval, type Workflow } from '@/lib/api';

interface InboxState {
  approvals: Approval[];
  workflows: Workflow[];
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  addApproval: (approval: Approval) => void;
  removeApproval: (id: string) => void;
  updateWorkflow: (id: string, data: Partial<Workflow>) => void;
}

export const useInbox = create<InboxState>((set, get) => ({
  approvals: [],
  workflows: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const [approvalsRes, workflowsRes] = await Promise.all([
        api.getApprovals('status=pending'),
        api.getWorkflows('limit=50'),
      ]);
      set({
        approvals: approvalsRes.data,
        workflows: workflowsRes.data,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', loading: false });
    }
  },

  addApproval: (approval) => {
    set((s) => ({
      approvals: [approval, ...s.approvals.filter((a) => a.id !== approval.id)],
    }));
  },

  removeApproval: (id) => {
    set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) }));
  },

  updateWorkflow: (id, data) => {
    set((s) => ({
      workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...data } : w)),
    }));
  },
}));
