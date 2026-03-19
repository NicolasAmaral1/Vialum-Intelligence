'use client';

import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { conversationsApi } from '@/lib/api/conversations';
import { useAuthStore } from '@/stores/auth.store';
import { useToast } from '@/hooks/use-toast';
import { Search, Check, MoreVertical, Undo2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { Conversation } from '@/types/api';

interface ConversationHeaderProps {
  conversation: Conversation;
  onRefresh: () => void;
  onToggleSidebar?: () => void;
}

export function ConversationHeader({ conversation, onRefresh, onToggleSidebar }: ConversationHeaderProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();

  const isGroup = !!conversation.group;
  const displayName = isGroup
    ? conversation.group?.name || 'Grupo sem nome'
    : conversation.contact?.displayName || conversation.contact?.name || 'Sem nome';
  const avatarUrl = isGroup
    ? conversation.group?.profilePicUrl
    : conversation.contact?.avatarUrl;
  const groupTypeLabel = conversation.group?.groupType === 'agency' ? 'Grupo agência' : 'Grupo cliente';
  const subtitle = isGroup ? groupTypeLabel : conversation.contact?.formattedPhone || conversation.contact?.phone;

  const isResolved = conversation.status === 'resolved';

  const handleToggleStatus = async () => {
    if (!currentAccount) return;
    try {
      if (isResolved) {
        await conversationsApi.reopen(currentAccount.accountId, conversation.id);
      } else {
        await conversationsApi.resolve(currentAccount.accountId, conversation.id);
      }
      onRefresh();
    } catch {
      toast({ title: 'Erro ao atualizar status', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-raised border-b border-border px-5 py-2.5 flex items-center justify-between">
      {/* Left side */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
      >
        <div className="relative">
          <ContactAvatar
            name={displayName}
            avatarUrl={avatarUrl}
            size={36}
          />
          {/* Online indicator removed — no presence tracking yet */}
        </div>
        <div className="text-left">
          <h3 className="text-[14px] font-semibold text-text-1 flex items-center gap-1.5">
            {isGroup && <span className="text-[11px]">👥</span>}
            {displayName}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-text-3">
              {subtitle}
            </p>
          )}
        </div>
      </button>

      {/* Right side */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="p-2 rounded-lg hover:bg-white/[0.05] text-text-3"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={handleToggleStatus}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-1.5 ${
            isResolved
              ? 'bg-warning/10 text-warning'
              : 'bg-success/10 text-success'
          }`}
        >
          {isResolved ? (
            <>
              <Undo2 className="w-3.5 h-3.5" />
              Reabrir
            </>
          ) : (
            <>
              <Check className="w-3.5 h-3.5" />
              Resolver
            </>
          )}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-white/[0.05] text-text-3"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled>Atribuir agente</DropdownMenuItem>
            <DropdownMenuItem disabled>Adiar conversa</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Gerenciar labels</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
