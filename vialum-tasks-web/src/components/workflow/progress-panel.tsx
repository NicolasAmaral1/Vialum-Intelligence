'use client';
import { cn } from '@/lib/utils';
import type { Workflow } from '@/lib/api';

interface WfStage {
  id: string;
  definitionStageId: string;
  name: string;
  position: number;
  status: string;
  tasks?: Array<{
    id: string;
    name: string;
    status: string;
    steps?: Array<{
      id: string;
      name: string;
      status: string;
      executor: string;
    }>;
  }>;
}

interface Props {
  workflow: Workflow;
}

export function ProgressPanel({ workflow }: Props) {
  const wfStages = (workflow as Record<string, unknown>).wfStages as WfStage[] | undefined;

  if (wfStages && wfStages.length > 0) {
    return <V2Progress stages={wfStages} currentStageId={(workflow as Record<string, unknown>).currentStageId as string} />;
  }

  const raw = workflow.definition?.stages;
  const stages = (Array.isArray(raw) ? raw : []) as Array<{ id: string; label: string; position: number }>;
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  const currentIndex = sorted.findIndex((s) => s.id === workflow.stage);

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Progresso</h3>
      {sorted.map((stage, i) => {
        const isCompleted = i < currentIndex;
        const isCurrent = i === currentIndex;
        const isFuture = i > currentIndex;

        return (
          <div key={stage.id} className="flex items-center gap-3 py-1.5">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
              isCompleted && 'bg-primary/20 text-primary',
              isCurrent && 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
              isFuture && 'bg-muted text-muted-foreground/40',
            )}>
              {isCompleted ? <CheckIcon /> : i + 1}
            </div>
            <span className={cn(
              'text-sm',
              isCompleted && 'text-muted-foreground',
              isCurrent && 'text-foreground font-medium',
              isFuture && 'text-muted-foreground/40',
            )}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function V2Progress({ stages, currentStageId }: { stages: WfStage[]; currentStageId?: string }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Progresso</h3>
      {sorted.map((stage) => {
        const isCompleted = stage.status === 'completed';
        const isCurrent = stage.id === currentStageId || stage.status === 'active';
        const isPending = stage.status === 'pending';

        return (
          <div key={stage.id} className="space-y-0.5">
            <div className="flex items-center gap-3 py-1.5">
              <div className={cn(
                'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
                isCompleted && 'bg-primary/20 text-primary',
                isCurrent && 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
                isPending && 'bg-muted text-muted-foreground/40',
              )}>
                {isCompleted ? <CheckIcon /> : stage.position}
              </div>
              <span className={cn(
                'text-sm',
                isCompleted && 'text-muted-foreground',
                isCurrent && 'text-foreground font-medium',
                isPending && 'text-muted-foreground/40',
              )}>
                {stage.name}
              </span>
            </div>

            {isCurrent && stage.tasks && stage.tasks.length > 0 && (
              <div className="ml-8 space-y-0.5">
                {stage.tasks.map((task) => (
                  <div key={task.id} className="space-y-0.5">
                    {task.steps && task.steps.map((step) => {
                      const stepDone = step.status === 'completed';
                      const stepActive = step.status === 'running' || step.status === 'awaiting_human' || step.status === 'awaiting_client';
                      const stepIcon = step.executor === 'human' ? 'H' : step.executor === 'ai' ? 'AI' : 'S';

                      return (
                        <div key={step.id} className="flex items-center gap-2 py-0.5">
                          <div className={cn(
                            'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-bold',
                            stepDone && 'bg-primary/20 text-primary',
                            stepActive && 'bg-warning/20 text-warning',
                            !stepDone && !stepActive && 'bg-muted text-muted-foreground/40',
                          )}>
                            {stepDone ? <CheckIcon /> : stepIcon}
                          </div>
                          <span className={cn(
                            'text-xs',
                            stepDone && 'text-muted-foreground',
                            stepActive && 'text-foreground font-medium',
                            !stepDone && !stepActive && 'text-muted-foreground/40',
                          )}>
                            {step.name}
                          </span>
                          {step.status === 'awaiting_human' && (
                            <span className="text-[9px] text-warning font-medium">aguardando</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
