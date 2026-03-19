'use client';

import { Search, ChevronDown, Eye } from 'lucide-react';
import { useRef, useCallback, useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { inboxesApi } from '@/lib/api/inboxes';
import type { ConversationStatus, ConversationFilters, Inbox } from '@/types/api';

interface InboxWithMeta extends Inbox {
  isMine?: boolean;
}

interface InboxFiltersProps {
  filters: ConversationFilters;
  onFilterChange: (partial: Partial<ConversationFilters>) => void;
}

const tabs: { value: 'all' | 'mine' | 'unassigned'; label: string; status: ConversationStatus | null }[] = [
  { value: 'all', label: 'Todas', status: null },
  { value: 'mine', label: 'Minhas', status: 'open' as ConversationStatus },
  { value: 'unassigned', label: 'Não atribuídas', status: 'pending' as ConversationStatus },
];

const INBOX_FILTER_KEY = 'vialum_selected_inbox';

export function InboxFilters({ onFilterChange }: InboxFiltersProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [inboxes, setInboxes] = useState<InboxWithMeta[]>([]);
  const [canSeeAll, setCanSeeAll] = useState(false);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const currentAccount = useAuthStore((s) => s.currentAccount);

  // Fetch inboxes
  useEffect(() => {
    if (!currentAccount) return;
    inboxesApi.list(currentAccount.accountId).then((res) => {
      const data = (res as { data: InboxWithMeta[]; meta?: { canSeeAll?: boolean } }).data;
      const meta = (res as { data: InboxWithMeta[]; meta?: { canSeeAll?: boolean } }).meta;
      setInboxes(data);
      setCanSeeAll(meta?.canSeeAll ?? false);

      // Auto-select: restore saved OR default to my inbox
      const saved = localStorage.getItem(INBOX_FILTER_KEY);
      if (saved && data.some((i) => i.id === saved)) {
        setSelectedInboxId(saved);
        onFilterChange({ inboxId: saved });
      } else {
        // Default to first "isMine" inbox
        const myInbox = data.find((i) => i.isMine);
        if (myInbox) {
          setSelectedInboxId(myInbox.id);
          onFilterChange({ inboxId: myInbox.id });
          localStorage.setItem(INBOX_FILTER_KEY, myInbox.id);
        }
      }
      setInitialized(true);
    }).catch(() => {});
  }, [currentAccount]);

  // Close switcher on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ search: value || undefined });
      }, 300);
    },
    [onFilterChange]
  );

  const handleTabChange = (tab: typeof tabs[number]) => {
    setActiveTab(tab.value);
    onFilterChange({ status: tab.status });
  };

  const handleInboxChange = (inboxId: string | null) => {
    setSelectedInboxId(inboxId);
    setShowSwitcher(false);
    onFilterChange({ inboxId });
    if (inboxId) {
      localStorage.setItem(INBOX_FILTER_KEY, inboxId);
    } else {
      localStorage.removeItem(INBOX_FILTER_KEY);
    }
  };

  const selectedInbox = inboxes.find((i) => i.id === selectedInboxId);

  // Generate initials for inbox avatar
  const getInitials = (name: string) => {
    const words = name.split(/\s+/);
    return words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  if (!initialized) return null;

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Inbox Switcher */}
      <div className="relative mb-3" ref={switcherRef}>
        <button
          type="button"
          onClick={() => setShowSwitcher(!showSwitcher)}
          className="flex items-center gap-3 w-full p-2.5 rounded-xl bg-surface-custom border border-border hover:border-primary/40 transition-all duration-200 group"
        >
          {/* Inbox avatar */}
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-[11px] font-bold shrink-0">
            {selectedInbox ? getInitials(selectedInbox.name) : <Eye className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-text-1 truncate">
              {selectedInbox ? selectedInbox.name : 'Todas as inboxes'}
            </p>
            <p className="text-[10px] text-text-4">
              {selectedInbox
                ? (selectedInbox as InboxWithMeta).isMine ? 'Minha inbox' : 'Inbox do time'
                : 'Visualizando todas'}
            </p>
          </div>
          <ChevronDown className={`w-4 h-4 text-text-3 transition-transform duration-200 ${showSwitcher ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {showSwitcher && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-raised border border-border rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* My inboxes */}
            {inboxes.filter((i) => i.isMine).length > 0 && (
              <>
                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-text-4">
                  Minhas inboxes
                </p>
                {inboxes.filter((i) => i.isMine).map((inbox) => (
                  <InboxOption
                    key={inbox.id}
                    inbox={inbox}
                    isSelected={selectedInboxId === inbox.id}
                    getInitials={getInitials}
                    onClick={() => handleInboxChange(inbox.id)}
                  />
                ))}
              </>
            )}

            {/* Team inboxes (non-mine, only for admin) */}
            {canSeeAll && inboxes.filter((i) => !i.isMine).length > 0 && (
              <>
                <div className="my-1.5 mx-3 border-t border-border" />
                <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-widest text-text-4">
                  Inboxes do time
                </p>
                {inboxes.filter((i) => !i.isMine).map((inbox) => (
                  <InboxOption
                    key={inbox.id}
                    inbox={inbox}
                    isSelected={selectedInboxId === inbox.id}
                    getInitials={getInitials}
                    onClick={() => handleInboxChange(inbox.id)}
                  />
                ))}
              </>
            )}

            {/* See all option (admin only) */}
            {canSeeAll && (
              <>
                <div className="my-1.5 mx-3 border-t border-border" />
                <button
                  type="button"
                  onClick={() => handleInboxChange(null)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors ${
                    !selectedInboxId ? 'bg-primary/[0.06]' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] ${
                    !selectedInboxId
                      ? 'bg-primary/20 text-primary'
                      : 'bg-surface-custom text-text-3'
                  }`}>
                    <Eye className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-[12px] font-medium ${!selectedInboxId ? 'text-primary' : 'text-text-2'}`}>
                      Ver todas as inboxes
                    </p>
                    <p className="text-[10px] text-text-4">Visão geral do time</p>
                  </div>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pill tabs */}
      <div className="flex gap-1 mb-3">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleTabChange(tab)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150 ${
              activeTab === tab.value
                ? 'bg-primary/[0.14] text-primary'
                : 'text-text-3'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-4" />
        <input
          type="text"
          placeholder="Buscar conversa..."
          className="w-full pl-9 pr-3 py-2 rounded-xl text-[12px] bg-surface-custom border border-border text-text-1 focus:outline-none focus:border-primary/50 placeholder:text-text-4"
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Inbox option sub-component ──

function InboxOption({
  inbox,
  isSelected,
  getInitials,
  onClick,
}: {
  inbox: InboxWithMeta;
  isSelected: boolean;
  getInitials: (name: string) => string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors ${
        isSelected ? 'bg-primary/[0.06]' : ''
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold ${
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'bg-surface-custom text-text-2'
      }`}>
        {getInitials(inbox.name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-medium truncate ${isSelected ? 'text-primary' : 'text-text-1'}`}>
          {inbox.name}
        </p>
      </div>
      {isSelected && (
        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}
