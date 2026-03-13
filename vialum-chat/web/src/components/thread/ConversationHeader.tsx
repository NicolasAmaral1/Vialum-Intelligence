'use client';

import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { ConversationActions } from './ConversationActions';
import type { Conversation } from '@/types/api';

interface ConversationHeaderProps {
  conversation: Conversation;
  onRefresh: () => void;
}

export function ConversationHeader({ conversation, onRefresh }: ConversationHeaderProps) {
  const isGroup = !!conversation.group;
  const displayName = isGroup
    ? conversation.group?.name || 'Grupo sem nome'
    : conversation.contact?.name || 'Sem nome';
  const avatarUrl = isGroup
    ? conversation.group?.profilePicUrl
    : conversation.contact?.avatarUrl;
  const subtitle = isGroup
    ? conversation.group?.groupType === 'agency' ? 'Grupo agência' : 'Grupo cliente'
    : conversation.contact?.phone;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-3">
        <ContactAvatar
          name={displayName}
          avatarUrl={avatarUrl}
        />
        <div>
          <h3 className="font-medium text-sm flex items-center gap-1.5">
            {isGroup && <span className="text-muted-foreground">👥</span>}
            {displayName}
          </h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      <ConversationActions conversation={conversation} onRefresh={onRefresh} />
    </div>
  );
}
