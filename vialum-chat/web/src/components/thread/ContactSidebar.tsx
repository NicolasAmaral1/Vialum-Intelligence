'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Loader2, FolderOpen, BarChart3, CheckSquare, Phone, Mail, GitBranch } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import type { ContactCrmSummary, CrmIntegrationSummary } from '@/types/crm';
import type { Contact, Label } from '@/types/api';

interface ActiveTalkInfo {
  id: string;
  status: string;
  treeFlowId: string;
  treeFlow?: { name: string; slug: string; category: string | null } | null;
  talkFlow?: { currentStepId: string } | null;
}

interface ContactSidebarProps {
  contact: Contact;
  conversationStatus: string;
  labels: Label[];
  activeTalk: ActiveTalkInfo | null;
  pendingSuggestionsCount: number;
  onClose: () => void;
}

export function ContactSidebar({
  contact,
  conversationStatus,
  labels,
  activeTalk,
  pendingSuggestionsCount,
  onClose,
}: ContactSidebarProps) {
  const [crmData, setCrmData] = useState<ContactCrmSummary | null>(null);
  const [crmLoading, setCrmLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCrmLoading(true);

    crmApi.getContactSummary(contact.id, {
      phone: contact.phone ?? undefined,
      name: contact.name ?? undefined,
      email: contact.email ?? undefined,
    }).then((result) => {
      if (!cancelled && result?.data) {
        setCrmData(result.data);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setCrmLoading(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  const initials = contact.name?.slice(0, 2).toUpperCase() || '??';

  const statusLabel = {
    open: 'Aberta',
    pending: 'Pendente',
    resolved: 'Resolvida',
    snoozed: 'Adiada',
  }[conversationStatus] ?? conversationStatus;

  const statusStyles: Record<string, string> = {
    open: 'bg-success/10 text-success',
    pending: 'bg-warning/10 text-warning',
    resolved: 'bg-text-3/10 text-text-3',
  };
  const statusClasses = statusStyles[conversationStatus] ?? 'bg-text-3/10 text-text-3';

  // Funnel progress calculation
  const funnelStages = ['lead', 'qualificado', 'proposta', 'negociacao', 'fechado'];
  const currentStageIndex = contact.funnelStage
    ? funnelStages.indexOf(contact.funnelStage.toLowerCase())
    : -1;
  const funnelProgress = currentStageIndex >= 0
    ? Math.round(((currentStageIndex + 1) / funnelStages.length) * 100)
    : 0;

  // Group CRM integrations by provider
  const pipedriveItems = crmData?.integrations?.filter((i) => i.provider === 'pipedrive') ?? [];
  const clickupItems = crmData?.integrations?.filter((i) => i.provider === 'clickup') ?? [];
  const gdriveItems = crmData?.integrations?.filter((i) => i.provider === 'gdrive') ?? [];

  return (
    <div className="w-[360px] flex flex-col shrink-0 overflow-y-auto bg-raised border-l border-border animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-[13px] font-semibold text-text-2">Detalhes do Contato</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-3 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile card */}
      <div className="border-b border-border px-4 py-6 flex flex-col items-center">
        <div className="h-[72px] w-[72px] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-lg font-bold">
          {initials}
        </div>
        <h4 className="mt-3 text-[16px] font-semibold text-text-1">{contact.name}</h4>
        {contact.phone && (
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-text-3">
            <Phone className="h-3 w-3" />
            {contact.phone}
          </div>
        )}
        {contact.email && (
          <div className="flex items-center gap-1.5 mt-1 text-[12px] text-text-3">
            <Mail className="h-3 w-3" />
            {contact.email}
          </div>
        )}
        {contact.funnelStage && (
          <div className="mt-4 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-text-3">Estágio do funil</span>
              <span className="text-[11px] font-medium text-primary">{contact.funnelStage}</span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-surface-custom">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all"
                style={{ width: `${funnelProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions / Status section */}
      <div className="px-4 py-4 space-y-3 border-b border-border">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Status</h5>

        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-2">Conversa</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>

        {activeTalk && activeTalk.treeFlow?.name && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-2">TreeFlow</span>
            <span className="text-[11px] text-text-1">{activeTalk.treeFlow.name}</span>
          </div>
        )}

        {activeTalk && activeTalk.talkFlow?.currentStepId && (
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-text-2">Step</span>
            <span className="text-[11px] text-text-1">{activeTalk.talkFlow.currentStepId}</span>
          </div>
        )}

        {/* Labels */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-2">Labels</span>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {labels.map((label) => (
              <span
                key={label.id}
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${label.color}20`, color: label.color }}
              >
                {label.name}
              </span>
            ))}
            <button className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-text-4 text-text-3 hover:text-text-2 transition-colors">
              + Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* Talk section */}
      <div className="px-4 py-4 space-y-2 border-b border-border">
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-3 w-3 text-text-4" />
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Talk</h5>
        </div>

        {activeTalk ? (
          <div className="rounded-xl p-3 bg-surface-custom space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-3">Flow</span>
              <span className="text-[11px] font-medium text-text-1">
                {activeTalk.treeFlow?.name ?? 'Sem nome'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-3">Status</span>
              <div className="flex items-center gap-1.5">
                {activeTalk.status === 'active' ? (
                  <>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-success" />
                    <span className="text-[11px] font-medium text-success">Ativo</span>
                  </>
                ) : (
                  <span className="text-[11px] font-medium text-text-1 capitalize">{activeTalk.status}</span>
                )}
              </div>
            </div>
            {activeTalk.talkFlow?.currentStepId && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-3">Step atual</span>
                <span className="text-[11px] font-medium text-text-1">{activeTalk.talkFlow.currentStepId}</span>
              </div>
            )}
            {pendingSuggestionsCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-3">Sugestões</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[hsl(var(--ai)_/_0.08)] text-[hsl(var(--ai))]">
                  {pendingSuggestionsCount} pendente{pendingSuggestionsCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl p-3 bg-surface-custom">
            <span className="text-[11px] text-text-3">Nenhum talk ativo</span>
          </div>
        )}
      </div>

      {/* Previous conversations / CRM */}
      {crmLoading ? (
        <div className="px-4 py-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-text-3" />
          <span className="ml-2 text-xs text-text-3">Carregando CRM...</span>
        </div>
      ) : (
        <>
          {/* Pipedrive */}
          {pipedriveItems.length > 0 && (
            <div className="px-4 py-4 space-y-2 border-b border-border">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Pipedrive</h5>
              {pipedriveItems.map((item) => (
                <IntegrationCard key={item.id} item={item} icon={<BarChart3 className="h-3.5 w-3.5" />} />
              ))}
            </div>
          )}

          {/* ClickUp */}
          {clickupItems.length > 0 && (
            <div className="px-4 py-4 space-y-2 border-b border-border">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">ClickUp</h5>
              {clickupItems.map((item) => (
                <IntegrationCard key={item.id} item={item} icon={<CheckSquare className="h-3.5 w-3.5" />} />
              ))}
            </div>
          )}

          {/* Google Drive */}
          {gdriveItems.length > 0 && (
            <div className="px-4 py-4 space-y-2 border-b border-border">
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Google Drive</h5>
              {gdriveItems.map((item) => (
                <IntegrationCard key={item.id} item={item} icon={<FolderOpen className="h-3.5 w-3.5" />} />
              ))}
            </div>
          )}

          {pipedriveItems.length === 0 && clickupItems.length === 0 && gdriveItems.length === 0 && (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-text-3">Nenhuma integração CRM vinculada</p>
            </div>
          )}
        </>
      )}

      {/* Notes */}
      {contact.notes && (
        <div className="px-4 py-4 space-y-2">
          <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Notas</h5>
          <p className="text-xs text-text-3 leading-relaxed whitespace-pre-wrap">
            {contact.notes}
          </p>
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}

// ── Sub-components ──

function IntegrationCard({ item, icon }: { item: CrmIntegrationSummary; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-custom cursor-pointer hover:brightness-110 transition-all">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-text-3">{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] text-text-2 truncate">
            {item.resourceName ?? item.externalId}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {item.status && (
              <span className="text-[10px] text-text-4 capitalize">{item.status}</span>
            )}
            {item.stage && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-overlay text-text-3">{item.stage}</span>
            )}
            {item.value != null && (
              <span className="text-[10px] font-medium text-text-1">
                R$ {Number(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>
      </div>
      {item.externalUrl && (
        <a
          href={item.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-3 hover:text-primary transition-colors flex-shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
