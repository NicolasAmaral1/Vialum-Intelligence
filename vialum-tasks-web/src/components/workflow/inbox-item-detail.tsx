'use client';
import { useState } from 'react';
import { api, type InboxItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { MarkdownView } from '@/components/ui/markdown-view';

interface Props {
  item: InboxItem;
  stepOutputs?: Record<string, unknown>;
  onCompleted: () => void;
}

interface SchemaProperty {
  type: string;
  enum?: string[];
  description?: string;
}

export function InboxItemDetail({ item, stepOutputs, onCompleted }: Props) {
  const schema = item.outputSchema as {
    type?: string;
    required?: string[];
    properties?: Record<string, SchemaProperty>;
  } | undefined;

  const properties = schema?.properties || {};
  const required = schema?.required || [];
  const fields = Object.entries(properties);

  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const [key, prop] of fields) {
      if (prop.type === 'boolean') initial[key] = false;
      else if (prop.type === 'number' || prop.type === 'integer') initial[key] = 0;
      else initial[key] = '';
    }
    return initial;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.completeInboxItem(item.id, formData);
      onCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao completar');
    } finally {
      setSubmitting(false);
    }
  };

  const rawInput = item.inputData as Record<string, unknown> | undefined;
  const hasInput = rawInput && Object.keys(rawInput).length > 0;
  const inputData = hasInput ? rawInput : stepOutputs;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_hsl(var(--warning)/0.4)]" />
        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
        {item.assigneeRole && (
          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
            {item.assigneeRole}
          </span>
        )}
      </div>

      {item.description && (
        <p className="text-xs text-muted-foreground">{item.description}</p>
      )}

      {inputData && Object.keys(inputData).length > 0 && (
        <div className="p-3 rounded-md bg-muted/50 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resultado da IA</p>
          {Object.entries(inputData).map(([key, value]) => {
            const strVal = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
            const isMarkdown = typeof value === 'string' && (value.includes('# ') || value.includes('**') || value.includes('\n---'));
            const isLongJson = typeof value === 'object' && JSON.stringify(value).length > 200;
            const isArray = Array.isArray(value);

            if (isMarkdown) {
              return (
                <div key={key}>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{key}:</p>
                  <div className="max-h-64 overflow-y-auto rounded border border-border/30 p-2 bg-background/50">
                    <MarkdownView content={strVal} />
                  </div>
                </div>
              );
            }

            if (isArray) {
              return (
                <div key={key}>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{key}:</p>
                  <div className="space-y-0.5">
                    {(value as unknown[]).map((item, i) => (
                      <div key={i} className="text-xs text-foreground/80 pl-2 border-l border-border/30 py-0.5">
                        {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            if (isLongJson) {
              return (
                <div key={key}>
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{key}:</p>
                  <pre className="text-[10px] text-foreground/70 bg-background/50 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto border border-border/30">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                </div>
              );
            }

            return (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-muted-foreground font-medium flex-shrink-0">{key}:</span>
                <span className="text-foreground">{strVal}</span>
              </div>
            );
          })}
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map(([key, prop]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-foreground mb-1">
                {key}
                {required.includes(key) && <span className="text-danger ml-0.5">*</span>}
                {prop.description && (
                  <span className="text-muted-foreground font-normal ml-1">({prop.description})</span>
                )}
              </label>

              {prop.type === 'boolean' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formData[key])}
                    onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                    className="w-4 h-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">{formData[key] ? 'Sim' : 'Nao'}</span>
                </label>
              ) : prop.enum ? (
                <select
                  value={String(formData[key] || '')}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground"
                >
                  <option value="">Selecione...</option>
                  {prop.enum.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : prop.type === 'number' || prop.type === 'integer' ? (
                <input
                  type="number"
                  value={Number(formData[key] || 0)}
                  onChange={(e) => setFormData({ ...formData, [key]: Number(e.target.value) })}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground"
                />
              ) : (
                <input
                  type="text"
                  value={String(formData[key] || '')}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  placeholder={`Digite ${key}...`}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground/50"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-2 rounded-md bg-danger/10 border border-danger/20 text-xs text-danger">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={cn(
          'w-full px-4 py-2 text-xs font-semibold rounded-md transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          submitting && 'opacity-50 cursor-not-allowed'
        )}
      >
        {submitting ? 'Enviando...' : 'Completar'}
      </button>
    </div>
  );
}
