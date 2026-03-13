'use client';

import { useParams } from 'next/navigation';
import { ConversationItem } from './ConversationItem';
import { InboxFilters } from './InboxFilters';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useConversations } from '@/hooks/useConversations';
import { MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export function ConversationList() {
  const params = useParams();
  const activeId = params?.conversationId as string | undefined;
  const { conversations, loading, filters, updateFilters } = useConversations();

  return (
    <div className="flex flex-col h-full w-[320px] border-r border-border/50 bg-background">
      <div className="px-4 py-3.5 border-b border-border/50">
        <h2 className="text-base font-semibold tracking-tight">Conversas</h2>
      </div>
      <InboxFilters filters={filters} onFilterChange={updateFilters} />
      <ScrollArea className="flex-1">
        {loading && conversations.length === 0 ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma conversa"
            description="As conversas aparecerão aqui quando os contatos enviarem mensagens."
          />
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeId}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
