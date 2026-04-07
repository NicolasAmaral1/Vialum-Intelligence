'use client';
import { cn } from '@/lib/utils';
import type { Workflow } from '@/lib/api';

interface Props {
  workflow: Workflow;
}

export function ProgressPanel({ workflow }: Props) {
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
            {/* Indicator */}
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold',
              isCompleted && 'bg-primary/20 text-primary',
              isCurrent && 'bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--primary)/0.3)]',
              isFuture && 'bg-muted text-muted-foreground/40',
            )}>
              {isCompleted ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                i + 1
              )}
            </div>

            {/* Label */}
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
