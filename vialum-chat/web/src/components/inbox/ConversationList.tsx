'use client';

import { useParams } from 'next/navigation';
import { ConversationItem } from './ConversationItem';
import { InboxFilters } from './InboxFilters';
import { SkeletonConversation } from './SkeletonConversation';
import { EmptyState } from '@/components/shared/EmptyState';
import { useConversations } from '@/hooks/useConversations';
import { MessageSquare } from 'lucide-react';

export function ConversationList() {
  const params = useParams();
  const activeId = params?.conversationId as string | undefined;
  const { conversations, loading, filters, updateFilters } = useConversations();

  return (
    <div className="flex flex-col h-full w-[340px] border-r border-border bg-raised shrink-0">
      <InboxFilters filters={filters} onFilterChange={updateFilters} />

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonConversation key={i} />
            ))}
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
      </div>
    </div>
  );
}
