'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  workflowId: string;
  clientData: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function DataEditor({ workflowId, clientData, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>(clientData);
  const [saving, setSaving] = useState(false);

  const fields = Object.entries(draft).filter(([_, v]) => v !== null && v !== undefined);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateWorkflow(workflowId, { client_data: draft });
      onUpdate(draft);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save:', err);
    }
    setSaving(false);
  };

  const handleSaveAndRegen = async () => {
    setSaving(true);
    try {
      await api.updateWorkflow(workflowId, { client_data: draft });
      onUpdate(draft);
      await api.sendCommand(workflowId, `Os dados do cliente foram atualizados. Re-gere os documentos com os novos dados: ${JSON.stringify(draft)}`);
      setEditing(false);
    } catch (err) {
      console.error('Failed to save & regen:', err);
    }
    setSaving(false);
  };

  const updateField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados do Cliente</h3>
          <button
            onClick={() => { setDraft(clientData); setEditing(true); }}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Editar
          </button>
        </div>
        <div className="space-y-1.5">
          {fields.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <span className="text-muted-foreground min-w-[100px] flex-shrink-0">{formatLabel(key)}</span>
              <span className="text-foreground truncate">{String(value)}</span>
            </div>
          ))}
          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground/50 italic">Sem dados</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Editar Dados</h3>
      <div className="space-y-2">
        {fields.map(([key, value]) => (
          <div key={key}>
            <label className="block text-[11px] text-muted-foreground mb-0.5">{formatLabel(key)}</label>
            <input
              value={String(draft[key] ?? '')}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-card border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          onClick={handleSaveAndRegen}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          Salvar e re-gerar
        </button>
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
