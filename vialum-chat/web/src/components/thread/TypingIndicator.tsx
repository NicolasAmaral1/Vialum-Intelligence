'use client';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  return (
    <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
      {typingUsers.length === 1
        ? 'Alguém está digitando...'
        : `${typingUsers.length} pessoas estão digitando...`}
    </div>
  );
}
