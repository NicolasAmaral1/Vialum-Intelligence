'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { aiSuggestionsApi } from '@/lib/api/ai-suggestions';
import { messagesApi } from '@/lib/api/messages';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import type { AISuggestion } from '@/types/api';

export default function AIQueuePage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await aiSuggestionsApi.list(currentAccount.accountId, {
        status: 'pending',
      });
      setSuggestions(result.data);
    } catch (err) {
      console.error('Failed to fetch suggestions', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === suggestions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((s) => s.id)));
    }
  };

  async function handleBulkApprove() {
    if (!currentAccount || selected.size === 0) return;
    setBulkActing(true);
    try {
      const ids = Array.from(selected);
      await aiSuggestionsApi.bulkUpdate(currentAccount.accountId, ids, 'approved');
      // Send each approved message
      for (const id of ids) {
        const s = suggestions.find((s) => s.id === id);
        if (s) {
          await messagesApi.create(currentAccount.accountId, s.conversationId, {
            content: s.content,
            messageType: 'outgoing',
            contentType: 'text',
          });
        }
      }
      toast({ title: `${ids.length} sugestões aprovadas e enviadas` });
      setSelected(new Set());
      fetchSuggestions();
    } catch {
      toast({ title: 'Erro ao aprovar em massa', variant: 'destructive' });
    } finally {
      setBulkActing(false);
    }
  }

  async function handleBulkReject() {
    if (!currentAccount || selected.size === 0) return;
    setBulkActing(true);
    try {
      const ids = Array.from(selected);
      await aiSuggestionsApi.bulkUpdate(currentAccount.accountId, ids, 'rejected');
      toast({ title: `${ids.length} sugestões rejeitadas` });
      setSelected(new Set());
      fetchSuggestions();
    } catch {
      toast({ title: 'Erro ao rejeitar em massa', variant: 'destructive' });
    } finally {
      setBulkActing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold">Fila de IA</h1>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selected.size} selecionada(s)
            </span>
            <Button size="sm" onClick={handleBulkApprove} disabled={bulkActing}>
              {bulkActing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
              Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkReject} disabled={bulkActing}>
              <X className="h-4 w-4 mr-1" />
              Rejeitar
            </Button>
          </div>
        )}
      </div>

      {suggestions.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Fila vazia"
          description="Nenhuma sugestão pendente de revisão."
        />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="p-3 w-10">
                  <Checkbox
                    checked={selected.size === suggestions.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="p-3">Conteúdo</th>
                <th className="p-3 w-32">Confiança</th>
                <th className="p-3 w-40">Criada</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr
                  key={s.id}
                  className="border-b hover:bg-accent/50 cursor-pointer"
                  onClick={() => toggleSelect(s.id)}
                >
                  <td className="p-3">
                    <Checkbox
                      checked={selected.has(s.id)}
                      onCheckedChange={() => toggleSelect(s.id)}
                    />
                  </td>
                  <td className="p-3">
                    <p className="text-sm line-clamp-2">{s.content}</p>
                  </td>
                  <td className="p-3">
                    {s.confidence !== null && (
                      <Badge variant={s.confidence >= 0.8 ? 'default' : 'secondary'}>
                        {Math.round(s.confidence * 100)}%
                      </Badge>
                    )}
                  </td>
                  <td className="p-3">
                    <RelativeTime date={s.createdAt} className="text-xs text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
