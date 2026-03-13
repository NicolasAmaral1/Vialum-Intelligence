'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { contactsApi } from '@/lib/api/contacts';
import { Input } from '@/components/ui/input';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Users, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Contact } from '@/types/api';

export default function ContactsPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchContacts = useCallback(
    async (q?: string) => {
      if (!currentAccount) return;
      setLoading(true);
      try {
        const result = await contactsApi.list(currentAccount.accountId, {
          search: q || undefined,
          page: 1,
          limit: 50,
        });
        setContacts(result.data);
      } catch (err) {
        console.error('Failed to fetch contacts', err);
      } finally {
        setLoading(false);
      }
    },
    [currentAccount]
  );

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSearch = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchContacts(value), 300);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold">Contatos</h1>
      </div>
      <div className="px-6 py-3 border-b">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <LoadingSpinner />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum contato"
          description={search ? 'Nenhum resultado para a busca.' : 'Os contatos aparecerão aqui.'}
        />
      ) : (
        <ScrollArea className="flex-1">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-3">Contato</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">E-mail</th>
                <th className="p-3">Criado</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b hover:bg-accent/50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <ContactAvatar name={contact.name} avatarUrl={contact.avatarUrl} />
                      <span className="font-medium text-sm">{contact.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {contact.phone || '-'}
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    {contact.email || '-'}
                  </td>
                  <td className="p-3">
                    <RelativeTime date={contact.createdAt} className="text-xs text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}
