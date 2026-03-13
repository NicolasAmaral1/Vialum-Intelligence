'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth.store';
import { conversationsApi } from '@/lib/api/conversations';
import { CheckCircle2, RotateCcw, MoreVertical, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Conversation } from '@/types/api';

interface ConversationActionsProps {
  conversation: Conversation;
  onRefresh: () => void;
}

export function ConversationActions({ conversation, onRefresh }: ConversationActionsProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [acting, setActing] = useState(false);

  async function handleResolve() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await conversationsApi.resolve(currentAccount.accountId, conversation.id);
      toast({ title: 'Conversa resolvida' });
      onRefresh();
    } catch {
      toast({ title: 'Erro ao resolver conversa', variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  async function handleReopen() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await conversationsApi.reopen(currentAccount.accountId, conversation.id);
      toast({ title: 'Conversa reaberta' });
      onRefresh();
    } catch {
      toast({ title: 'Erro ao reabrir conversa', variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  const isResolved = conversation.status === 'resolved';

  return (
    <div className="flex items-center gap-1">
      {isResolved ? (
        <Button variant="outline" size="sm" onClick={handleReopen} disabled={acting}>
          {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
          Reabrir
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={handleResolve} disabled={acting}>
          {acting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Resolver
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>Atribuir agente</DropdownMenuItem>
          <DropdownMenuItem disabled>Adiar conversa</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>Gerenciar labels</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
