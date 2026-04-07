'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useInbox } from '@/stores/inbox';
import { getSocket, connectSocket } from '@/lib/socket';
import { InboxItemCard, WorkflowItem } from './inbox-item';
import type { InboxItem } from '@/lib/api';

export function InboxList() {
  const router = useRouter();
  const { items, workflows, loading, error, fetch, addItem, removeItem, updateWorkflow } = useInbox();

  useEffect(() => {
    fetch();

    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      connectSocket();
      socket = getSocket();
    } catch (err) {
      console.warn('Socket.IO connection failed:', err);
      return;
    }

    socket.on('inbox:item_created', (data: InboxItem) => {
      addItem(data);
    });

    socket.on('inbox:item_completed', (data: { id: string }) => {
      removeItem(data.id);
    });

    socket.on('workflow:updated', (data: { workflowId: string; status: string }) => {
      updateWorkflow(data.workflowId, { status: data.status });
    });

    return () => {
      socket?.off('inbox:item_created');
      socket?.off('inbox:item_completed');
      socket?.off('workflow:updated');
    };
  }, []);

  const pendingItems = items.filter((i) => i.status === 'pending');
  const activeWorkflows = workflows.filter((w) =>
    ['running', 'hitl', 'paused', 'idle'].includes(w.status) && !w.completedAt
  );
  const hasPending = pendingItems.length > 0;
  const hasActive = activeWorkflows.length > 0;

  if (loading && !items.length && !workflows.length) {
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
      {hasPending && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-danger" />
            Precisam de voce ({pendingItems.length})
          </h2>
          <div className="space-y-2">
            {pendingItems.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onClick={() => router.push(`/workflows/${item.workflowId}`)}
              />
            ))}
          </div>
        </section>
      )}

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

      {!hasPending && !hasActive && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Tudo em dia</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhuma pendencia no momento</p>
        </div>
      )}
    </div>
  );
}
