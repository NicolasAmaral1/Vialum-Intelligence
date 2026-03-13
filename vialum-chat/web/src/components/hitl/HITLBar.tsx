'use client';

import { useSuggestionsStore } from '@/stores/suggestions.store';
import { SuggestionCard } from './SuggestionCard';

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
    <div className="border-t bg-muted/30 px-4 py-2 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Sugestões da IA ({pending.length})
      </p>
      {pending.map((suggestion) => (
        <SuggestionCard
          key={suggestion.id}
          suggestion={suggestion}
          conversationId={conversationId}
        />
      ))}
    </div>
  );
}
