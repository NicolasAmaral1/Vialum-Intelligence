'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInbox } from '@/stores/inbox';
import { api } from '@/lib/api';
import { getSocket, connectSocket } from '@/lib/socket';
import { ApprovalItem, WorkflowItem } from './inbox-item';
import type { Approval, Workflow } from '@/lib/api';

export function InboxList() {
  const router = useRouter();
  const { approvals, workflows, loading, error, fetch, addApproval, removeApproval, updateWorkflow } = useInbox();

  useEffect(() => {
    fetch();

    // Socket.IO real-time
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      connectSocket();
      socket = getSocket();
    } catch (err) {
      console.warn('Socket.IO connection failed:', err);
      return;
    }

    socket.on('approval:created', (data: Approval) => {
      addApproval(data);
    });

    socket.on('workflow:updated', (data: { workflowId: string; status: string }) => {
      updateWorkflow(data.workflowId, { status: data.status });
      // If approval was decided, refresh approvals
      if (data.status === 'running') {
        fetch();
      }
    });

    return () => {
      socket?.off('approval:created');
      socket?.off('workflow:updated');
    };
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.decideApproval(id, { status: 'approved' });
      removeApproval(id);
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Motivo da rejeição:');
    if (reason === null) return;
    try {
      await api.decideApproval(id, { status: 'rejected', reason });
      removeApproval(id);
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  // Split workflows into categories
  const activeWorkflows = workflows.filter((w) =>
    ['running', 'hitl', 'paused', 'idle'].includes(w.status) && !w.completedAt
  );
  const hasHitl = approvals.length > 0;
  const hasActive = activeWorkflows.length > 0;

  if (loading && !approvals.length && !workflows.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HITL Section */}
      {hasHitl && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            Precisam de você ({approvals.length})
          </h2>
          <div className="space-y-2">
            {approvals.map((a) => (
              <ApprovalItem
                key={a.id}
                approval={a}
                onApprove={handleApprove}
                onReject={handleReject}
                onClick={() => router.push(`/workflows/${a.workflowId}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Active workflows */}
      {hasActive && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Em andamento ({activeWorkflows.length})
          </h2>
          <div className="space-y-0.5">
            {activeWorkflows.map((w) => (
              <WorkflowItem
                key={w.id}
                workflow={w}
                onClick={() => router.push(`/workflows/${w.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasHitl && !hasActive && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhuma pendência no momento</p>
        </div>
      )}
    </div>
  );
}
