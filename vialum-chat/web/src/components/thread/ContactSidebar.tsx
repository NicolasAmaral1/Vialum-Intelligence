'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Bot, MessageSquare, Loader2, FolderOpen, BarChart3, CheckSquare, Phone, Mail, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  }, [contact.id]);

  const initials = contact.name?.slice(0, 2).toUpperCase() || '??';

  const statusLabel = {
    open: 'Aberta',
    pending: 'Pendente',
    resolved: 'Resolvida',
    snoozed: 'Adiada',
  }[conversationStatus] ?? conversationStatus;

  const statusColor = {
    open: 'bg-emerald-500',
    pending: 'bg-amber-500',
    resolved: 'bg-zinc-500',
    snoozed: 'bg-blue-500',
  }[conversationStatus] ?? 'bg-zinc-500';

  // Group CRM integrations by provider
  const pipedriveItems = crmData?.integrations?.filter((i) => i.provider === 'pipedrive') ?? [];
  const clickupItems = crmData?.integrations?.filter((i) => i.provider === 'clickup') ?? [];
  const gdriveItems = crmData?.integrations?.filter((i) => i.provider === 'gdrive') ?? [];

  return (
    <div className="w-80 border-l border-border/50 bg-background flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-semibold text-foreground">Detalhes do Contato</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile */}
        <div className="px-4 py-5 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-lg font-bold shadow-lg shadow-primary/20">
            {initials}
          </div>
          <h4 className="mt-3 font-semibold text-foreground">{contact.name}</h4>
          {contact.phone && (
            <div className="flex items-center justify-center gap-1.5 mt-1 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </div>
          )}
          {contact.email && (
            <div className="flex items-center justify-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
              <Mail className="h-3 w-3" />
              {contact.email}
            </div>
          )}
          {contact.funnelStage && (
            <Badge variant="outline" className="mt-2 text-xs border-primary/30 text-primary">
              {contact.funnelStage}
            </Badge>
          )}
        </div>

        <Separator className="opacity-30" />

        {/* Status Section */}
        <SidebarSection title="Status">
          <div className="space-y-2">
            <InfoRow
              icon={<div className={`h-2 w-2 rounded-full ${statusColor}`} />}
              label="Conversa"
              value={statusLabel}
            />
            {activeTalk ? (
              <>
                <InfoRow
                  icon={<Bot className="h-3.5 w-3.5 text-primary" />}
                  label="TreeFlow"
                  value={activeTalk.treeFlow?.name ?? 'Ativo'}
                />
                {activeTalk.talkFlow?.currentStepId && (
                  <InfoRow
                    icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
                    label="Step"
                    value={activeTalk.talkFlow.currentStepId}
                  />
                )}
                <InfoRow
                  icon={<div className={`h-2 w-2 rounded-full ${activeTalk.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />}
                  label="Talk"
                  value={activeTalk.status}
                />
              </>
            ) : (
              <InfoRow
                icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                label="TreeFlow"
                value="Nenhum ativo"
                muted
              />
            )}
            {pendingSuggestionsCount > 0 && (
              <InfoRow
                icon={<MessageSquare className="h-3.5 w-3.5 text-amber-500" />}
                label="HITL"
                value={`${pendingSuggestionsCount} pendente${pendingSuggestionsCount > 1 ? 's' : ''}`}
                highlight
              />
            )}
          </div>
        </SidebarSection>

        {/* CRM Integrations */}
        {crmLoading ? (
          <div className="px-4 py-6 flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">Carregando CRM...</span>
          </div>
        ) : (
          <>
            {/* Pipedrive */}
            {pipedriveItems.length > 0 && (
              <SidebarSection title="Pipedrive">
                {pipedriveItems.map((item) => (
                  <IntegrationCard key={item.id} item={item} icon={<BarChart3 className="h-3.5 w-3.5" />} />
                ))}
              </SidebarSection>
            )}

            {/* ClickUp */}
            {clickupItems.length > 0 && (
              <SidebarSection title="ClickUp">
                {clickupItems.map((item) => (
                  <IntegrationCard key={item.id} item={item} icon={<CheckSquare className="h-3.5 w-3.5" />} />
                ))}
              </SidebarSection>
            )}

            {/* Google Drive */}
            {gdriveItems.length > 0 && (
              <SidebarSection title="Google Drive">
                {gdriveItems.map((item) => (
                  <IntegrationCard key={item.id} item={item} icon={<FolderOpen className="h-3.5 w-3.5" />} />
                ))}
              </SidebarSection>
            )}

            {pipedriveItems.length === 0 && clickupItems.length === 0 && gdriveItems.length === 0 && (
              <div className="px-4 py-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhuma integração CRM vinculada</p>
              </div>
            )}
          </>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <SidebarSection title="Labels">
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="text-[10px] px-2 py-0.5"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  <Tag className="h-2.5 w-2.5 mr-1" />
                  {label.name}
                </Badge>
              ))}
            </div>
          </SidebarSection>
        )}

        {/* Notes */}
        {contact.notes && (
          <SidebarSection title="Notas">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {contact.notes}
            </p>
          </SidebarSection>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Sub-components ──

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </h5>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  muted,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className={`text-xs font-medium ${muted ? 'text-muted-foreground' : highlight ? 'text-amber-500' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}

function IntegrationCard({ item, icon }: { item: CrmIntegrationSummary; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 mb-2 last:mb-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-primary">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {item.resourceName ?? item.externalId}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.status && (
                <span className="text-[10px] text-muted-foreground capitalize">{item.status}</span>
              )}
              {item.stage && (
                <span className="text-[10px] text-primary/80">{item.stage}</span>
              )}
              {item.value != null && (
                <span className="text-[10px] font-medium text-foreground">
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
            className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
