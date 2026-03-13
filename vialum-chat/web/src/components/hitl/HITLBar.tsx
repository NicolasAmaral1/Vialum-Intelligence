'use client';

import { Sparkles } from 'lucide-react';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { MessageBlockCard } from './MessageBlockCard';

interface HITLBarProps {
  conversationId: string;
}

export function HITLBar({ conversationId }: HITLBarProps) {
  const suggestions = useSuggestionsStore(
    (s) => s.byConversation[conversationId] || []
  );
  const pending = suggestions.filter((s) => s.status === 'pending');

  if (pending.length === 0) return null;

  return (
    <div className="bg-ai-surface border-t-2 border-[hsl(var(--ai)_/_0.4)] px-4 py-3">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[hsl(var(--ai))]" />
          <span className="text-[12px] font-semibold text-[hsl(var(--ai))]">
            Sugestão da IA
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--ai)_/_0.08)] text-[hsl(var(--ai))]">
            {pending.length}
          </span>
        </div>
        {pending.map((suggestion) => (
          <MessageBlockCard
            key={suggestion.id}
            suggestion={suggestion}
            conversationId={conversationId}
          />
        ))}
      </div>
    </div>
  );
}
