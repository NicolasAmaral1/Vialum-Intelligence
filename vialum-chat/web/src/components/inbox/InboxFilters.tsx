'use client';

import { Search } from 'lucide-react';
import { useRef, useCallback, useState } from 'react';
import type { ConversationStatus, ConversationFilters } from '@/types/api';

interface InboxFiltersProps {
  filters: ConversationFilters;
  onFilterChange: (partial: Partial<ConversationFilters>) => void;
}

const tabs: { value: 'all' | 'mine' | 'unassigned'; label: string; status: ConversationStatus | null }[] = [
  { value: 'all', label: 'Todas', status: null },
  { value: 'mine', label: 'Minhas', status: 'open' as ConversationStatus },
  { value: 'unassigned', label: 'Não atribuídas', status: 'pending' as ConversationStatus },
];

export function InboxFilters({ onFilterChange }: InboxFiltersProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'unassigned'>('all');

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

  return (
    <div className="px-4 pt-4 pb-2">
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-text-1">Conversas</h2>
        <button
          type="button"
          className="p-1.5 rounded-lg hover:bg-white/[0.05] text-text-3"
        >
          <Search className="w-4 h-4" />
        </button>
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
