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

  const hasUnread = conversation.unreadCount > 0;
  const labels = conversation.conversationLabels ?? [];

  return (
    <Link
      href={`/inbox/${conversation.id}`}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 transition-all duration-150 border-l-2',
        isActive
          ? 'bg-primary/[0.08] border-l-primary'
          : 'border-l-transparent hover:bg-white/[0.03]'
      )}
    >
      {/* Avatar area */}
      <div className="relative shrink-0">
        <ContactAvatar
          name={displayName}
          avatarUrl={avatarUrl}
          size={40}
        />
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] text-white border border-raised bg-[#25D366]">
          W
        </span>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 text-left">
        {/* Name row */}
        <div className="flex justify-between gap-2">
          <span className={cn(
            'text-[13px] truncate flex items-center gap-1.5',
            hasUnread ? 'font-semibold text-text-1' : 'font-medium text-text-2'
          )}>
            {isGroup && <span className="text-[11px]">👥</span>}
            {displayName}
          </span>
          <RelativeTime
            date={conversation.lastActivityAt}
            className={cn(
              'text-[10px] shrink-0',
              hasUnread ? 'text-primary' : 'text-text-4'
            )}
          />
        </div>

        {/* Preview */}
        <p className={cn(
          'text-[12px] truncate mt-0.5',
          hasUnread ? 'text-text-2' : 'text-text-3'
        )}>
          {preview}
        </p>

        {/* Labels row */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {labels.map((cl) => (
            cl.label && (
              <span
                key={cl.labelId}
                className="text-[9.5px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: cl.label.color ? `${cl.label.color}18` : undefined,
                  color: cl.label.color || undefined,
                }}
              >
                {cl.label.name}
              </span>
            )
          ))}
          {conversation.inbox && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-full text-text-4 bg-surface-custom">
              {conversation.inbox.name}
            </span>
          )}
          {isGroup && (
            <span className="text-[9.5px] px-1.5 py-0.5 rounded-full text-text-4 bg-surface-custom">
              {conversation.group?.groupType === 'agency' ? 'Agência' : 'Cliente'}
            </span>
          )}
          {hasUnread && (
            <span className="ml-auto h-[18px] min-w-[18px] flex items-center justify-center px-1 text-[10px] font-bold rounded-full bg-primary text-primary-foreground">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
