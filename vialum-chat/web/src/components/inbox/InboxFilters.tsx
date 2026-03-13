'use client';

import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';
import { useRef, useCallback } from 'react';
import type { ConversationStatus, ConversationFilters } from '@/types/api';

interface InboxFiltersProps {
  filters: ConversationFilters;
  onFilterChange: (partial: Partial<ConversationFilters>) => void;
}

const statusTabs: { value: ConversationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'open', label: 'Abertas' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'resolved', label: 'Resolvidas' },
];

export function InboxFilters({ filters, onFilterChange }: InboxFiltersProps) {
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onFilterChange({ search: value || undefined });
      }, 300);
    },
    [onFilterChange]
  );

  return (
    <div className="p-3 space-y-3 border-b border-border/50">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conversas..."
          className="pl-9 h-9"
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>
      <Tabs
        value={filters.status || 'all'}
        onValueChange={(v) =>
          onFilterChange({ status: v === 'all' ? null : (v as ConversationStatus) })
        }
      >
        <TabsList className="w-full">
          {statusTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1 text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
