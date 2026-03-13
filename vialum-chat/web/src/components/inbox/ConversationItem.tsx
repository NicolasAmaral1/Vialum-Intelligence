'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { RelativeTime } from '@/components/shared/RelativeTime';
import type { Conversation } from '@/types/api';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const isGroup = !!conversation.group;
  const displayName = isGroup
    ? conversation.group?.name || 'Grupo sem nome'
    : conversation.contact?.name || 'Sem nome';
  const avatarUrl = isGroup
    ? conversation.group?.profilePicUrl
    : conversation.contact?.avatarUrl;

  const lastMsg = conversation.lastMessage ?? conversation.messages?.[0];
  const senderPrefix = isGroup && lastMsg?.senderContact?.name
    ? `${lastMsg.senderContact.name.split(' ')[0]}: `
    : '';
  const preview = lastMsg?.content
    ? senderPrefix + lastMsg.content.slice(0, 80) + (lastMsg.content.length > 80 ? '...' : '')
    : 'Sem mensagens';

  return (
    <Link
      href={`/inbox/${conversation.id}`}
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-border/30 transition-all duration-150',
        isActive
          ? 'bg-primary/[0.08] border-l-2 border-l-primary'
          : 'hover:bg-white/[0.03] border-l-2 border-l-transparent'
      )}
    >
      <ContactAvatar
        name={displayName}
        avatarUrl={avatarUrl}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-sm truncate flex items-center gap-1.5',
            conversation.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
          )}>
            {isGroup && <span className="text-muted-foreground text-xs">👥</span>}
            {displayName}
          </span>
          <RelativeTime
            date={conversation.lastActivityAt}
            className={cn(
              'text-[10px] shrink-0',
              conversation.unreadCount > 0 ? 'text-primary font-medium' : 'text-muted-foreground'
            )}
          />
        </div>
        <p className={cn(
          'text-xs truncate mt-0.5',
          conversation.unreadCount > 0 ? 'text-foreground/60' : 'text-muted-foreground'
        )}>
          {preview}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          {conversation.inbox && (
            <span className="text-[10px] text-muted-foreground bg-white/[0.05] px-1.5 py-0.5 rounded-md">
              {conversation.inbox.name}
            </span>
          )}
          {isGroup && (
            <span className="text-[10px] text-muted-foreground bg-white/[0.05] px-1.5 py-0.5 rounded-md">
              {conversation.group?.groupType === 'agency' ? 'Agência' : 'Cliente'}
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span className="h-[18px] min-w-[18px] flex items-center justify-center px-1 text-[10px] font-semibold rounded-full bg-primary text-primary-foreground">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
