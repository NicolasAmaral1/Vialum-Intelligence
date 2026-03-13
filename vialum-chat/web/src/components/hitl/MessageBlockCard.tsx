'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { aiSuggestionsApi } from '@/lib/api/ai-suggestions';
import { Sparkles, Check, X, Pencil, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { AISuggestion } from '@/types/api';

interface MessageBlockCardProps {
  suggestion: AISuggestion;
  conversationId: string;
}

export function MessageBlockCard({ suggestion, conversationId }: MessageBlockCardProps) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const updateSuggestion = useSuggestionsStore((s) => s.updateSuggestion);
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(suggestion.content);
  const [acting, setActing] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const senderLabel = (suggestion.context as Record<string, unknown>)?.senderLabel as string ?? 'IA';
  const flowName = (suggestion.context as Record<string, unknown>)?.flowName as string | undefined;
  const stepName = (suggestion.context as Record<string, unknown>)?.stepName as string | undefined;

  useEffect(() => {
    if (contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > contentRef.current.clientHeight);
    }
  }, [suggestion.content]);

  async function handleApprove() {
    if (!currentAccount) return;
    setActing(true);
    try {
      await aiSuggestionsApi.update(currentAccount.accountId, suggestion.id, {
        status: 'approved',
      });
      updateSuggestion(conversationId, suggestion.id, { status: 'sent' });
      toast({ title: 'Bloco aprovado — mensagens sendo enviadas' });
    } catch {
      toast({ title: 'Erro ao aprovar', variant: 'destructive' });
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
      toast({ title: 'Erro ao descartar', variant: 'destructive' });
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

  // Count message parts for preview
  const parts = suggestion.content.split(/\n\n+/).filter(s => s.trim().length > 0);
  const partCount = parts.length;

  const confidence = (suggestion as unknown as Record<string, unknown>).confidence as number | undefined;

  return (
    <div className="bg-[hsl(var(--ai)_/_0.05)] rounded-xl border border-[hsl(var(--ai)_/_0.15)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--ai)_/_0.06)] border-b border-[hsl(var(--ai)_/_0.1)]">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-[hsl(var(--ai)_/_0.2)] flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-[hsl(var(--ai))]" />
          </div>
          <span className="text-xs font-medium text-[hsl(var(--ai))]">{senderLabel}</span>
          {partCount > 1 && (
            <span className="text-[10px] text-text-3 bg-surface-custom px-1.5 py-0.5 rounded-full">
              {partCount} msgs
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        {editing ? (
          <div className="space-y-2">
            <p className="text-[10px] text-text-3 mb-1">
              Separe mensagens com linha em branco (Enter 2x)
            </p>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={Math.min(12, editContent.split('\n').length + 2)}
              className="text-sm bg-background/50 border-border/50 focus:ring-primary/30 resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setEditing(false); setEditContent(suggestion.content); }}
                disabled={acting}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSendEdited}
                disabled={acting}
                className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {acting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                Enviar editada
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              ref={contentRef}
              className={
                'text-[13px] leading-relaxed whitespace-pre-wrap text-text-2 ' +
                (!expanded ? 'line-clamp-3' : '')
              }
            >
              {suggestion.content}
            </div>

            {(isOverflowing || expanded) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-[hsl(var(--ai)_/_0.8)] hover:text-[hsl(var(--ai))] mt-1 transition-colors"
              >
                {expanded ? (
                  <>Ver Menos <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>Ver Mais <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}

            {/* Confidence bar */}
            {confidence != null && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-text-4">Confiança:</span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden bg-surface-custom">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${confidence}%`,
                      background: 'linear-gradient(90deg, hsl(var(--ai)), hsl(var(--primary)))',
                    }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[hsl(var(--ai))]">{confidence}%</span>
              </div>
            )}

            {/* Talk context */}
            {(flowName || stepName) && (
              <div className="flex items-center gap-1.5 mt-2">
                {flowName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-custom text-text-3">
                    {flowName}
                  </span>
                )}
                {stepName && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-custom text-text-3">
                    {stepName}
                  </span>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-1.5 mt-2 pt-2 border-t border-border/30">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleReject}
                disabled={acting}
                className="h-7 text-xs text-text-3 hover:text-danger"
              >
                <X className="h-3 w-3 mr-1" />
                Descartar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={acting}
                className="h-7 text-xs border border-[hsl(var(--ai)_/_0.3)] text-[hsl(var(--ai))]"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={acting}
                className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {acting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Aprovar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
