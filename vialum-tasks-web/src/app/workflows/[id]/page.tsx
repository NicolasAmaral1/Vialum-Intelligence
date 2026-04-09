'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkflowDetail, transcriptToLine, type TranscriptEntry } from '@/stores/workflow';
import { api, type InboxItem } from '@/lib/api';
import { getSocket, connectSocket } from '@/lib/socket';
import { ProgressPanel } from '@/components/workflow/progress-panel';
import { TimelinePanel } from '@/components/workflow/timeline-panel';
import { TerminalPanel } from '@/components/workflow/terminal-panel';
import { DataEditor } from '@/components/workflow/data-editor';
import { FilesPanel } from '@/components/workflow/files-panel';
import { InboxItemDetail } from '@/components/workflow/inbox-item-detail';
import { cn } from '@/lib/utils';
import type { WorkflowEvent } from '@/lib/api';

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { workflow, events, loading, error, fetch, setWorkflow, addEvent, addTerminalLine } = useWorkflowDetail();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);

  useEffect(() => {
    if (id) {
      fetch(id);
      api.getInbox(`workflowId=${id}&status=pending`).then((res) => {
        setInboxItems(res.data);
      }).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let socket: ReturnType<typeof getSocket> | null = null;
    try {
      connectSocket();
      socket = getSocket();
    } catch (err) {
      console.warn('Socket.IO connection failed:', err);
      return;
    }

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

    socket.on('inbox:item_created', (data: InboxItem) => {
      if (data.workflowId === id) {
        setInboxItems((prev) => [data, ...prev]);
      }
    });

    socket.on('inbox:item_completed', (data: { id: string }) => {
      setInboxItems((prev) => prev.filter((i) => i.id !== data.id));
    });

    socket.on('step:transcript', (data: { workflowId: string; stepId: string; entry: TranscriptEntry }) => {
      if (data.workflowId === id) {
        const line = transcriptToLine(data.entry, data.stepId);
        if (line) addTerminalLine(line);
      }
    });

    return () => {
      socket?.emit('workflow:unsubscribe', id);
      socket?.off('workflow:event');
      socket?.off('workflow:updated');
      socket?.off('inbox:item_created');
      socket?.off('inbox:item_completed');
      socket?.off('step:transcript');
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
          {error || 'Workflow nao encontrado'}
        </div>
      </div>
    );
  }

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

  const hasHumanStep = inboxItems.length > 0;
  const effectiveStatus = hasHumanStep ? 'hitl' : workflow.status;
  const status = statusLabel[effectiveStatus] || statusLabel.idle;
  const defName = workflow.definition?.name || 'Workflow';
  const clientData = (workflow.clientData || {}) as Record<string, unknown>;
  const clientName = clientData?.nome_marca || clientData?.nome || '';

  return (
    <div className="h-full flex flex-col">
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

      <div className="flex-1 min-h-0 flex">
        <div className="w-80 flex-shrink-0 border-r border-border overflow-y-auto p-4 space-y-6">
          <TimelinePanel stages={((workflow as unknown as Record<string, unknown>).wfStages || []) as Array<{ id: string; name: string; status: string; position: number; tasks: Array<{ id: string; name: string; status: string; steps: Array<{ id: string; name: string; executor: string; adapterType: string; status: string; startedAt: string | null; completedAt: string | null; output: Record<string, unknown> | null; errorMessage: string | null }> }> }>} />

          <DataEditor
            workflowId={workflow.id}
            clientData={workflow.clientData as Record<string, unknown>}
            onUpdate={(data) => setWorkflow({ clientData: data })}
          />

          <FilesPanel events={events} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col p-4 gap-4">
          {inboxItems.map((item) => {
            const ctx = workflow.context as Record<string, unknown> | undefined;
            const allOutputs = (ctx?.stepOutputs || {}) as Record<string, Record<string, unknown>>;
            const wfStages = (workflow as unknown as Record<string, unknown>).wfStages as Array<{tasks: Array<{steps: Array<{id: string; definitionStepId: string; status: string}>}>}> | undefined;
            let previousOutput: Record<string, unknown> | undefined;
            if (wfStages) {
              for (const stage of wfStages) {
                for (const task of stage.tasks || []) {
                  const steps = task.steps || [];
                  const itemIdx = steps.findIndex((s) => s.id === item.stepId);
                  if (itemIdx > 0) {
                    const prevStep = steps[itemIdx - 1];
                    previousOutput = allOutputs[prevStep.definitionStepId];
                  }
                }
              }
            }
            if (!previousOutput) {
              const outputKeys = Object.keys(allOutputs);
              if (outputKeys.length > 0) {
                previousOutput = allOutputs[outputKeys[outputKeys.length - 1]];
              }
            }
            return (
              <InboxItemDetail
                key={item.id}
                item={item}
                stepOutputs={previousOutput}
                onCompleted={() => {
                  setInboxItems((prev) => prev.filter((i) => i.id !== item.id));
                  fetch(workflow.id);
                }}
              />
            );
          })}

          <div className="flex-1 min-h-0">
            <TerminalPanel workflowId={workflow.id} commands={commands} />
          </div>
        </div>
      </div>
    </div>
  );
}
