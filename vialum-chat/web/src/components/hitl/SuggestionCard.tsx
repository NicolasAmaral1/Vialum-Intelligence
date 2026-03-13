'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { aiSuggestionsApi } from '@/lib/api/ai-suggestions';
import { Check, X, Pencil, Send, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AISuggestion } from '@/types/api';

interface SuggestionCardProps {
  suggestion: AISuggestion;
  conversationId: string;
}

export function SuggestionCard({ suggestion, conversationId }: SuggestionCardProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const updateSuggestion = useSuggestionsStore((s) => s.updateSuggestion);
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(suggestion.content);
  const [acting, setActing] = useState(false);

  async function handleApproveAndSend() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await aiSuggestionsApi.update(currentAccount.accountId, suggestion.id, {
        status: 'approved',
      });
      updateSuggestion(conversationId, suggestion.id, { status: 'sent' });
      toast({ title: 'Bloco aprovado — mensagens sendo enviadas' });
    } catch {
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await aiSuggestionsApi.update(currentAccount.accountId, suggestion.id, {
        status: 'rejected',
      });
      updateSuggestion(conversationId, suggestion.id, { status: 'rejected' });
    } catch {
      toast({ title: 'Erro ao rejeitar', variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  async function handleSendEdited() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await aiSuggestionsApi.update(currentAccount.accountId, suggestion.id, {
        status: 'edited',
        editedContent: editContent,
      });
      updateSuggestion(conversationId, suggestion.id, {
        status: 'sent',
        editedContent: editContent,
      });
      setEditing(false);
      toast({ title: 'Bloco editado e aprovado — mensagens sendo enviadas' });
    } catch {
      toast({ title: 'Erro ao enviar', variant: 'destructive' });
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="bg-background rounded-lg border p-3">
      {editing ? (
        <div className="space-y-2">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={acting}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSendEdited} disabled={acting}>
              {acting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Enviar editada
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm mb-2">{suggestion.content}</p>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={handleReject} disabled={acting}>
              <X className="h-3 w-3 mr-1" />
              Descartar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={acting}>
              <Pencil className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button size="sm" onClick={handleApproveAndSend} disabled={acting}>
              {acting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
              Enviar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
