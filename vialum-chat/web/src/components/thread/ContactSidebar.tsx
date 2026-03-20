'use client';

import { useEffect, useState, useRef } from 'react';
import { X, ExternalLink, Loader2, FolderOpen, BarChart3, CheckSquare, Phone, Mail, GitBranch, Users, RefreshCw, Shield, Pencil, Check } from 'lucide-react';
import { crmApi } from '@/lib/api/crm';
import { groupsApi, type GroupMember } from '@/lib/api/groups';
import { contactsApi } from '@/lib/api/contacts';
import { useAuthStore } from '@/stores/auth.store';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { formatPhoneBR } from '@/lib/format-phone';
import type { ContactCrmSummary, CrmIntegrationSummary } from '@/types/crm';
import type { Contact, Label, Group } from '@/types/api';

interface ActiveTalkInfo {
  id: string;
  status: string;
  treeFlowId: string;
  treeFlow?: { name: string; slug: string; category: string | null } | null;
  talkFlow?: { currentStepId: string } | null;
}

interface ContactSidebarProps {
  contact: Contact;
  group?: Group | null;
  conversationStatus: string;
  labels: Label[];
  activeTalk: ActiveTalkInfo | null;
  pendingSuggestionsCount: number;
  onClose: () => void;
}

export function ContactSidebar({
  contact,
  group,
  conversationStatus,
  labels,
  activeTalk,
  pendingSuggestionsCount,
  onClose,
}: ContactSidebarProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const [crmData, setCrmData] = useState<ContactCrmSummary | null>(null);
  const [crmLoading, setCrmLoading] = useState(true);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const isGroup = !!group;

  // Fetch CRM data for contacts (not groups)
  useEffect(() => {
    if (isGroup) {
      setCrmLoading(false);
      return;
    }
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
  }, [contact.id, isGroup]);

  // Fetch group members
  useEffect(() => {
    if (!isGroup || !group?.id || !currentAccount) return;
    let cancelled = false;
    setGroupLoading(true);

    groupsApi.get(currentAccount.accountId, group.id).then((result) => {
      if (!cancelled && result?.data?.members) {
        setGroupMembers(result.data.members);
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setGroupLoading(false);
    });

    return () => { cancelled = true; };
  }, [group?.id, isGroup, currentAccount]);

  const handleSyncGroup = async () => {
    if (!group?.id || !currentAccount || syncing) return;
    setSyncing(true);
    try {
      await groupsApi.sync(currentAccount.accountId, group.id);
      // Re-fetch members after sync
      const result = await groupsApi.get(currentAccount.accountId, group.id);
      if (result?.data?.members) {
        setGroupMembers(result.data.members);
      }
    } catch {
      // silently fail
    } finally {
      setSyncing(false);
    }
  };

  const startEditName = () => {
    setEditNameValue(contact.customName || '');
    setEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveCustomName = async () => {
    if (!currentAccount || savingName) return;
    setSavingName(true);
    try {
      const trimmed = editNameValue.trim();
      await contactsApi.update(currentAccount.accountId, contact.id, {
        customName: trimmed || null, // null = clear custom name, fallback to CRM/pushName
      });
      // Update local contact state
      contact.customName = trimmed || null;
      contact.displayName = trimmed || contact.crmName || contact.name || contact.formattedPhone || contact.phone || 'Sem nome';
      setEditingName(false);
    } catch {
      // silently fail
    } finally {
      setSavingName(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveCustomName();
    if (e.key === 'Escape') setEditingName(false);
  };

  const displayName = isGroup ? (group?.name || 'Grupo sem nome') : (contact.displayName || contact.name);
  const initials = displayName?.slice(0, 2).toUpperCase() || '??';

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

  // Funnel progress calculation (contacts only)
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
        <h3 className="text-[13px] font-semibold text-text-2">
          {isGroup ? 'Detalhes do Grupo' : 'Detalhes do Contato'}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-3 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Profile card */}
      <div className="border-b border-border px-4 py-6 flex flex-col items-center">
        {isGroup && group?.profilePicUrl ? (
          <img
            src={group.profilePicUrl}
            alt={group.name}
            className="h-[72px] w-[72px] rounded-full object-cover"
          />
        ) : (
          <div className="h-[72px] w-[72px] rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-lg font-bold">
            {isGroup ? <Users className="h-7 w-7" /> : initials}
          </div>
        )}
        {/* Editable name */}
        {!isGroup && editingName ? (
          <div className="mt-3 flex items-center gap-1.5 w-full max-w-[280px]">
            <input
              ref={editInputRef}
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={handleEditKeyDown}
              placeholder={contact.crmName || (!/^\d+$/.test(contact.name) ? contact.name : null) || formatPhoneBR(contact.phone) || 'Nome personalizado'}
              className="flex-1 px-2.5 py-1.5 text-[14px] font-semibold text-text-1 bg-surface-custom border border-primary/50 rounded-lg focus:outline-none focus:border-primary text-center"
            />
            <button
              onClick={saveCustomName}
              disabled={savingName}
              className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-3 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <h4
            className="mt-3 text-[16px] font-semibold text-text-1 flex items-center gap-1.5 group cursor-pointer"
            onClick={!isGroup ? startEditName : undefined}
          >
            {isGroup && <span className="text-[13px]">👥</span>}
            {displayName}
            {!isGroup && (
              <Pencil className="h-3 w-3 text-text-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </h4>
        )}

        {/* Name source indicator */}
        {!isGroup && !editingName && (
          <span className="text-[9px] text-text-4 mt-0.5">
            {contact.customName ? 'Nome personalizado' : contact.crmName ? 'Nome do CRM' : /^\d+$/.test(contact.name) ? '' : 'Nome do WhatsApp'}
          </span>
        )}

        {isGroup ? (
          <>
            <span className="mt-1 text-[12px] text-text-3">
              {group?.groupType === 'agency' ? 'Grupo agência' : 'Grupo cliente'}
              {groupMembers.length > 0 && ` · ${groupMembers.length} membros`}
            </span>
            {group?.description && (
              <p className="mt-2 text-[11px] text-text-3 text-center leading-relaxed max-w-[280px]">
                {group.description}
              </p>
            )}
          </>
        ) : (
          <>
            {contact.phone && (
              <div className="flex items-center gap-1.5 mt-1 text-[12px] text-text-3">
                <Phone className="h-3 w-3" />
                {contact.formattedPhone || contact.phone}
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
          </>
        )}
      </div>

      {/* Group members section */}
      {isGroup && (
        <div className="px-4 py-4 space-y-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3 text-text-4" />
              <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">
                Membros ({groupMembers.length})
              </h5>
            </div>
            <button
              type="button"
              onClick={handleSyncGroup}
              disabled={syncing}
              className="p-1 rounded hover:bg-white/[0.05] text-text-4 hover:text-text-2 transition-colors disabled:opacity-50"
              title="Sincronizar membros do WhatsApp"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {groupLoading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-text-3" />
            </div>
          ) : groupMembers.length === 0 ? (
            <p className="text-[11px] text-text-3 py-2">Nenhum membro registrado</p>
          ) : (
            <div className="space-y-1 max-h-[240px] overflow-y-auto">
              {groupMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
                >
                  <ContactAvatar
                    name={member.contact.name}
                    avatarUrl={member.contact.avatarUrl}
                    size={28}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-text-1 truncate">{member.contact.name}</p>
                    {member.contact.phone && (
                      <p className="text-[10px] text-text-4 truncate">{member.contact.phone}</p>
                    )}
                  </div>
                  {(member.role === 'admin' || member.role === 'superadmin') && (
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      <Shield className="h-2.5 w-2.5" />
                      {member.role === 'superadmin' ? 'Dono' : 'Admin'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* CRM section — only for individual contacts */}
      {!isGroup && (
        <>
          {crmLoading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-text-3" />
              <span className="ml-2 text-xs text-text-3">Carregando CRM...</span>
            </div>
          ) : (
            <>
              {pipedriveItems.length > 0 && (
                <div className="px-4 py-4 space-y-2 border-b border-border">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">Pipedrive</h5>
                  {pipedriveItems.map((item) => (
                    <IntegrationCard key={item.id} item={item} icon={<BarChart3 className="h-3.5 w-3.5" />} />
                  ))}
                </div>
              )}

              {clickupItems.length > 0 && (
                <div className="px-4 py-4 space-y-2 border-b border-border">
                  <h5 className="text-[11px] font-semibold uppercase tracking-wider text-text-4">ClickUp</h5>
                  {clickupItems.map((item) => (
                    <IntegrationCard key={item.id} item={item} icon={<CheckSquare className="h-3.5 w-3.5" />} />
                  ))}
                </div>
              )}

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
        </>
      )}

      {/* Notes */}
      {!isGroup && contact.notes && (
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
