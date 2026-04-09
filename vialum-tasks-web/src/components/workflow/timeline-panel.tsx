'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Step {
  id: string;
  name: string;
  executor: string;
  adapterType: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  output: Record<string, unknown> | null;
  errorMessage: string | null;
}

interface Task {
  id: string;
  name: string;
  status: string;
  steps: Step[];
}

interface Stage {
  id: string;
  name: string;
  status: string;
  position: number;
  tasks: Task[];
}

interface Props {
  stages: Stage[];
}

export function TimelinePanel({ stages }: Props) {
  if (!stages || stages.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/40 italic">Nenhum historico ainda</div>
    );
  }

  const sorted = [...stages].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Timeline</h3>
      {sorted.map((stage) => (
        <StageBlock key={stage.id} stage={stage} />
      ))}
    </div>
  );
}

function StageBlock({ stage }: { stage: Stage }) {
  const statusColor: Record<string, string> = {
    completed: 'text-primary',
    active: 'text-foreground',
    pending: 'text-muted-foreground/40',
  };

  return (
    <div>
      <div className={cn('text-[11px] font-semibold uppercase tracking-wider mb-2', statusColor[stage.status] || 'text-muted-foreground')}>
        {stage.name}
      </div>
      <div className="space-y-1 ml-2 border-l border-border pl-3">
        {stage.tasks.flatMap((task) =>
          task.steps.map((step) => (
            <StepEntry key={step.id} step={step} />
          ))
        )}
      </div>
    </div>
  );
}

function StepEntry({ step }: { step: Step }) {
  const [expanded, setExpanded] = useState(false);

  const duration = getDuration(step.startedAt, step.completedAt);
  const isDone = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isActive = step.status === 'running' || step.status === 'awaiting_human' || step.status === 'awaiting_client';
  const isPending = step.status === 'pending';

  const executorIcon: Record<string, string> = {
    ai: 'AI',
    human: 'H',
    system: 'S',
    client: 'C',
  };

  const statusDot: Record<string, string> = {
    completed: 'bg-primary',
    running: 'bg-success animate-pulse',
    awaiting_human: 'bg-warning animate-pulse',
    awaiting_client: 'bg-warning',
    failed: 'bg-danger',
    pending: 'bg-muted-foreground/30',
  };

  const hasOutput = step.output && typeof step.output === 'object' && Object.keys(step.output).length > 0;

  return (
    <div className="relative">
      {/* Dot on timeline */}
      <div className={cn('absolute -left-[19px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-background', statusDot[step.status] || 'bg-muted')} />

      <div
        className={cn(
          'py-1.5 cursor-pointer rounded px-2 -mx-2 transition-colors',
          hasOutput && 'hover:bg-muted/30',
          isPending && 'opacity-40',
        )}
        onClick={() => hasOutput && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[9px] font-bold w-5 h-4 rounded flex items-center justify-center flex-shrink-0',
            isDone && 'bg-primary/15 text-primary',
            isActive && 'bg-warning/15 text-warning',
            isFailed && 'bg-danger/15 text-danger',
            isPending && 'bg-muted text-muted-foreground/40',
          )}>
            {executorIcon[step.executor] || '?'}
          </span>

          <span className={cn(
            'text-xs flex-1',
            isDone && 'text-muted-foreground',
            isActive && 'text-foreground font-medium',
            isFailed && 'text-danger',
            isPending && 'text-muted-foreground/40',
          )}>
            {step.name}
          </span>

          {duration && (
            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{duration}</span>
          )}

          {isActive && step.status === 'awaiting_human' && (
            <span className="text-[9px] text-warning font-medium flex-shrink-0">aguardando</span>
          )}

          {isActive && step.status === 'running' && (
            <span className="text-[9px] text-success font-medium flex-shrink-0">rodando</span>
          )}

          {hasOutput && (
            <svg className={cn('w-3 h-3 text-muted-foreground/30 flex-shrink-0 transition-transform', expanded && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          )}
        </div>

        {step.startedAt && isDone && (
          <div className="text-[9px] text-muted-foreground/30 ml-7 mt-0.5">
            {format(new Date(step.startedAt), "dd/MM HH:mm", { locale: ptBR })}
          </div>
        )}

        {isFailed && step.errorMessage && (
          <div className="text-[10px] text-danger/70 ml-7 mt-0.5 line-clamp-1">
            {step.errorMessage}
          </div>
        )}
      </div>

      {expanded && hasOutput && step.output && (
        <div className="ml-7 mt-1 mb-2 p-2 rounded bg-muted/30 border border-border/50">
          <OutputPreview output={step.output} />
        </div>
      )}
    </div>
  );
}

function OutputPreview({ output }: { output: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(output).map(([key, value]) => {
        const strVal = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        const isLong = strVal.length > 300;
        const isArray = Array.isArray(value);

        if (isArray) {
          return (
            <div key={key} className="text-[10px]">
              <span className="text-muted-foreground font-medium">{key}: </span>
              <span className="text-foreground/60">{(value as unknown[]).length} items</span>
            </div>
          );
        }

        return (
          <div key={key} className="text-[10px]">
            <span className="text-muted-foreground font-medium">{key}: </span>
            <span className="text-foreground/80">
              {isLong ? strVal.slice(0, 300) + '...' : strVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getDuration(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}min`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
