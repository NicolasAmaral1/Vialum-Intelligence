'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { conversationsApi } from '@/lib/api/conversations';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command';
import {
  MessageSquare,
  Check,
  Settings,
  GitBranch,
  Plus,
} from 'lucide-react';
import type { Conversation } from '@/types/api';

export function CommandBar() {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const storeItems = useConversationsStore((s) => s.items);
  const orderedIds = useConversationsStore((s) => s.orderedIds);

  // Cmd+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Recent conversations from store
  const recentConversations = orderedIds
    .slice(0, 5)
    .map((id) => storeItems[id])
    .filter(Boolean);

  const handleSearch = useCallback(
    async (value: string) => {
      if (!currentAccount || value.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const result = await conversationsApi.list(currentAccount.accountId, { search: value });
        setSearchResults(result.data ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [currentAccount]
  );

  const navigateTo = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const displayName = (conv: Conversation) =>
    conv.group?.name || conv.contact?.name || 'Sem nome';

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar conversas, contatos, ações..."
        onValueChange={handleSearch}
      />
      <CommandList>
        <CommandEmpty>
          {searching ? 'Buscando...' : 'Nenhum resultado encontrado.'}
        </CommandEmpty>

        {/* Search results */}
        {searchResults.length > 0 && (
          <CommandGroup heading="Resultados">
            {searchResults.map((conv) => (
              <CommandItem
                key={conv.id}
                onSelect={() => navigateTo(`/inbox/${conv.id}`)}
                className="gap-3"
              >
                <ContactAvatar
                  name={displayName(conv)}
                  avatarUrl={conv.contact?.avatarUrl}
                  size={24}
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-1">{displayName(conv)}</span>
                  {conv.lastMessage?.content && (
                    <p className="text-xs text-text-3 truncate">{conv.lastMessage.content}</p>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recent conversations */}
        {searchResults.length === 0 && recentConversations.length > 0 && (
          <CommandGroup heading="Conversas recentes">
            {recentConversations.map((conv) => (
              <CommandItem
                key={conv.id}
                onSelect={() => navigateTo(`/inbox/${conv.id}`)}
                className="gap-3"
              >
                <ContactAvatar
                  name={displayName(conv)}
                  avatarUrl={conv.contact?.avatarUrl}
                  size={24}
                />
                <span className="text-sm text-text-1 flex-1">{displayName(conv)}</span>
                {conv.unreadCount > 0 && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    {conv.unreadCount}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Quick actions */}
        <CommandGroup heading="Ações">
          <CommandItem onSelect={() => navigateTo('/inbox')}>
            <MessageSquare className="w-4 h-4 text-text-3" />
            <span>Ir para Inbox</span>
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('/treeflows')}>
            <GitBranch className="w-4 h-4 text-text-3" />
            <span>Tree Flows</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('/treeflows/new')}>
            <Plus className="w-4 h-4 text-text-3" />
            <span>Novo Tree Flow</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('/settings/account')}>
            <Settings className="w-4 h-4 text-text-3" />
            <span>Configurações</span>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              // Resolve current conversation shortcut
              setOpen(false);
            }}
          >
            <Check className="w-4 h-4 text-success" />
            <span>Resolver conversa atual</span>
            <CommandShortcut>⌘⇧R</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
