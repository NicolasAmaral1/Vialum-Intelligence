'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflowDetail } from '@/stores/workflow';
import { getSocket, connectSocket } from '@/lib/socket';
import { ProgressPanel } from '@/components/workflow/progress-panel';
import { TerminalPanel } from '@/components/workflow/terminal-panel';
import { DataEditor } from '@/components/workflow/data-editor';
import { FilesPanel } from '@/components/workflow/files-panel';
import { ApprovalCard } from '@/components/workflow/approval-card';
import { cn } from '@/lib/utils';
import type { WorkflowEvent } from '@/lib/api';

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { workflow, events, loading, error, fetch, setWorkflow, addEvent } = useWorkflowDetail();

  useEffect(() => {
    if (id) fetch(id);
  }, [id]);

  // Socket.IO: subscribe to workflow events
  useEffect(() => {
    if (!id) return;
    connectSocket();
    const socket = getSocket();

    socket.emit('workflow:subscribe', id);

    socket.on('workflow:event', (data: WorkflowEvent & { workflowId: string }) => {
      if (data.workflowId === id) {
        addEvent(data);
      }
    });

    socket.on('workflow:updated', (data: { workflowId: string; status: string }) => {
      if (data.workflowId === id) {
        setWorkflow({ status: data.status });
      }
    });

    return () => {
      socket.emit('workflow:unsubscribe', id);
      socket.off('workflow:event');
      socket.off('workflow:updated');
    };
  }, [id]);

  if (loading && !workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
          {error || 'Workflow não encontrado'}
        </div>
      </div>
    );
  }

  const pendingApprovals = workflow.approvals?.filter((a) => a.status === 'pending') || [];
  const commands = (workflow.definition?.commands || []) as Array<{ label: string; command: string; icon?: string }>;
  const statusLabel: Record<string, { text: string; color: string }> = {
    running: { text: 'IA trabalhando', color: 'bg-success' },
    paused: { text: 'Pausado', color: 'bg-muted-foreground' },
    hitl: { text: 'Aguardando humano', color: 'bg-warning' },
    idle: { text: 'Idle', color: 'bg-muted-foreground/50' },
    failed: { text: 'Erro', color: 'bg-danger' },
    completed: { text: 'Completo', color: 'bg-success' },
    cancelled: { text: 'Cancelado', color: 'bg-muted-foreground' },
  };
  const status = statusLabel[workflow.status] || statusLabel.idle;
  const defName = workflow.definition?.name || 'Workflow';
  const clientName = (workflow.clientData as Record<string, unknown>)?.nome_marca
    || (workflow.clientData as Record<string, unknown>)?.nome
    || '';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 h-14 flex items-center gap-4 px-6 border-b border-border">
        <button onClick={() => router.push('/inbox')} className="text-muted-foreground hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-foreground truncate">
            {defName}{clientName ? ` — ${clientName}` : ''}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', status.color)} />
          <span className="text-xs text-muted-foreground">{status.text}</span>
        </div>
      </header>

      {/* Content: 2-column layout */}
      <div className="flex-1 min-h-0 flex">
        {/* Left column: Progress + Data + Files */}
        <div className="w-72 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-6">
          <ProgressPanel workflow={workflow} />

          <DataEditor
            workflowId={workflow.id}
            clientData={workflow.clientData as Record<string, unknown>}
            onUpdate={(data) => setWorkflow({ clientData: data })}
          />

          <FilesPanel events={events} />
        </div>

        {/* Right column: Terminal + Approval */}
        <div className="flex-1 min-w-0 flex flex-col p-4 gap-4">
          {/* Pending approvals */}
          {pendingApprovals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              onDecided={() => fetch(workflow.id)}
            />
          ))}

          {/* Terminal */}
          <div className="flex-1 min-h-0">
            <TerminalPanel workflowId={workflow.id} commands={commands} />
          </div>
        </div>
      </div>
    </div>
  );
}
