'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { cannedResponsesApi } from '@/lib/api/canned-responses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label as FormLabel } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { CannedResponse } from '@/types/api';

export default function CannedResponsesPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [deleting, setDeleting] = useState<CannedResponse | null>(null);
  const [form, setForm] = useState({ shortCode: '', content: '' });
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await cannedResponsesApi.list(currentAccount.accountId);
      setItems(result.data);
    } catch (err) {
      console.error('Failed to fetch canned responses', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  function openCreate() {
    setEditing(null);
    setForm({ shortCode: '', content: '' });
    setDialogOpen(true);
  }

  function openEdit(item: CannedResponse) {
    setEditing(item);
    setForm({ shortCode: item.shortCode, content: item.content });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!currentAccount || !form.shortCode.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await cannedResponsesApi.update(currentAccount.accountId, editing.id, form);
        toast({ title: 'Resposta atualizada' });
      } else {
        await cannedResponsesApi.create(currentAccount.accountId, form);
        toast({ title: 'Resposta criada' });
      }
      setDialogOpen(false);
      fetchItems();
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentAccount || !deleting) return;
    try {
      await cannedResponsesApi.remove(currentAccount.accountId, deleting.id);
      toast({ title: 'Resposta removida' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchItems();
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
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
        <h1 className="text-xl font-semibold">Respostas Rápidas</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova resposta
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma resposta rápida"
          description="Crie atalhos para mensagens frequentes. Use /atalho no chat."
        >
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Criar resposta
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <code className="text-sm font-mono text-primary">/{item.shortCode}</code>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeleting(item);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar resposta' : 'Nova resposta rápida'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Atalho</FormLabel>
              <Input
                value={form.shortCode}
                onChange={(e) => setForm({ ...form, shortCode: e.target.value.replace(/\s/g, '') })}
                placeholder="saudacao"
              />
              <p className="text-xs text-muted-foreground">
                Use /{form.shortCode || 'atalho'} no chat para inserir esta resposta
              </p>
            </div>
            <div className="space-y-2">
              <FormLabel>Conteúdo</FormLabel>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Olá! Como posso ajudar?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.shortCode.trim() || !form.content.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover resposta"
        description={`Tem certeza que deseja remover "/${deleting?.shortCode}"?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
