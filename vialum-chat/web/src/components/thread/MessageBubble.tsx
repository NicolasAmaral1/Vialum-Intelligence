'use client';

import { cn } from '@/lib/utils';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Check, CheckCheck, Clock, AlertCircle, Lock } from 'lucide-react';
import type { Message } from '@/types/api';

interface MessageBubbleProps {
  message: Message;
}

const statusIcons: Record<string, React.ReactNode> = {
  sending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3 text-blue-500" />,
  failed: <AlertCircle className="h-3 w-3 text-destructive" />,
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutgoing = message.messageType === 'outgoing';
  const isActivity = message.messageType === 'activity';
  const isPrivate = message.private;

  if (isActivity) {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex mb-2',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-2 relative',
          isPrivate
            ? 'bg-yellow-500/10 border border-yellow-500/30'
            : isOutgoing
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted',
          message._optimistic && 'opacity-70'
        )}
      >
        {isPrivate && (
          <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-[10px] mb-1">
            <Lock className="h-3 w-3" />
            <span>Nota privada</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1',
            isOutgoing ? 'justify-end' : 'justify-start'
          )}
        >
          <RelativeTime
            date={message.createdAt}
            className={cn(
              'text-[10px]',
              isOutgoing && !isPrivate ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}
          />
          {isOutgoing && statusIcons[message.status]}
        </div>
      </div>
    </div>
  );
}
