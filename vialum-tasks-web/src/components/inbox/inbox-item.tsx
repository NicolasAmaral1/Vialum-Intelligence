'use client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Approval, Workflow } from '@/lib/api';

interface ApprovalItemProps {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClick: () => void;
}

export function ApprovalItem({ approval, onApprove, onReject, onClick }: ApprovalItemProps) {
  const timeAgo = formatDistanceToNow(new Date(approval.createdAt), { addSuffix: true, locale: ptBR });
  const workflowName = approval.workflow?.definition?.name || 'Workflow';
  const clientData = approval.workflow?.clientData as Record<string, unknown> | undefined;
  const clientName = clientData?.nome_marca || clientData?.nome || clientData?.razao_social || '';

  return (
    <div
      className="group flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 hover:shadow-card transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Priority dot */}
      <div className="mt-1 w-2.5 h-2.5 rounded-full bg-danger flex-shrink-0 shadow-[0_0_8px_hsl(var(--danger)/0.4)]" />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{approval.title}</h3>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {workflowName}{clientName ? ` — ${clientName}` : ''}
        </p>
        {approval.description && (
          <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{approval.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onApprove(approval.id); }}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
        >
          Aprovar
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReject(approval.id); }}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
        >
          Rejeitar
        </button>
      </div>
    </div>
  );
}

interface WorkflowItemProps {
  workflow: Workflow;
  onClick: () => void;
}

export function WorkflowItem({ workflow, onClick }: WorkflowItemProps) {
  const timeAgo = formatDistanceToNow(new Date(workflow.updatedAt), { addSuffix: true, locale: ptBR });
  const defName = workflow.definition?.name || 'Workflow';
  const clientData = workflow.clientData as Record<string, unknown>;
  const clientName = clientData?.nome_marca || clientData?.nome || '';

  const statusConfig: Record<string, { dot: string; label: string }> = {
    running: { dot: 'bg-success shadow-[0_0_8px_hsl(var(--success)/0.4)]', label: 'IA trabalhando' },
    paused: { dot: 'bg-muted-foreground', label: 'Pausado' },
    hitl: { dot: 'bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.4)]', label: 'Aguardando humano' },
    idle: { dot: 'bg-muted-foreground/50', label: 'Idle' },
    failed: { dot: 'bg-danger', label: 'Erro' },
    completed: { dot: 'bg-success', label: 'Completo' },
  };

  const status = statusConfig[workflow.status] || statusConfig.idle;
  const stages = Array.isArray(workflow.definition?.stages) ? workflow.definition.stages as Array<{ id: string; label: string }> : [];
  const stageLabel = stages.find((s) => s.id === workflow.stage)?.label || workflow.stage;

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', status.dot)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {defName}{clientName ? ` — ${clientName}` : ''}
          </span>
          <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">{stageLabel}</span>
          <span className="text-[10px] text-muted-foreground/60">{status.label}</span>
        </div>
      </div>

      <svg className="w-4 h-4 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </div>
  );
}
