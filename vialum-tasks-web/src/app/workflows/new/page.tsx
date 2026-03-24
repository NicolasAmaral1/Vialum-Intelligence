'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Definition } from '@/lib/api';
import { DynamicForm } from '@/components/launcher/dynamic-form';

export default function NewWorkflowPage() {
  const router = useRouter();
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [selected, setSelected] = useState<Definition | null>(null);
  const [clientData, setClientData] = useState<Record<string, unknown>>({});
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDefinitions()
      .then((res) => {
        setDefinitions(res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Falha ao carregar templates');
        setLoading(false);
      });
  }, []);

  const handleSelect = (def: Definition) => {
    setSelected(def);
    setClientData({});
    setContactPhone('');
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await api.createWorkflow({
        definition_id: selected.id,
        client_data: clientData,
        contact_phone: contactPhone || undefined,
      });
      router.push(`/workflows/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar workflow');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-bold text-foreground mb-1">Novo Workflow</h1>
      <p className="text-sm text-muted-foreground mb-6">Selecione o template e preencha os dados iniciais</p>

      {/* Template selector */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Template
        </label>
        <div className="grid gap-2">
          {definitions.map((def) => (
            <button
              key={def.id}
              onClick={() => handleSelect(def)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                selected?.id === def.id
                  ? 'border-primary bg-primary/5 shadow-glow'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                selected?.id === def.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {def.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{def.name}</p>
                {def.description && (
                  <p className="text-xs text-muted-foreground">{def.description}</p>
                )}
                {def.squad && (
                  <p className="text-[10px] text-primary/60 mt-0.5">{def.squad}</p>
                )}
              </div>
            </button>
          ))}

          {definitions.length === 0 && (
            <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
              Nenhum template configurado
            </p>
          )}
        </div>
      </div>

      {/* Dynamic form */}
      {selected && (
        <>
          {/* Contact phone (always available) */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Telefone do cliente (WhatsApp)
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+5543988740276"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Schema-driven fields */}
          {Object.keys(selected.dataSchema).length > 0 && (
            <div className="mb-6">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Dados
              </label>
              <DynamicForm
                schema={selected.dataSchema as { properties?: Record<string, { type: string; enum?: string[]; description?: string }>; required?: string[] }}
                values={clientData}
                onChange={setClientData}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Iniciando...' : 'Iniciar Workflow'}
          </button>
        </>
      )}
    </div>
  );
}
