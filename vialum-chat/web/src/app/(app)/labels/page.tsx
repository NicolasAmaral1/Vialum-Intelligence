'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { labelsApi } from '@/lib/api/labels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Tags, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Label } from '@/types/api';

const defaultColors = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

export default function LabelsPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Label | null>(null);
  const [deleting, setDeleting] = useState<Label | null>(null);
  const [form, setForm] = useState({ name: '', color: '#3b82f6', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchLabels = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await labelsApi.list(currentAccount.accountId);
      setLabels(result.data);
    } catch (err) {
      console.error('Failed to fetch labels', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', color: '#3b82f6', description: '' });
    setDialogOpen(true);
  }

  function openEdit(label: Label) {
    setEditing(label);
    setForm({ name: label.name, color: label.color, description: label.description || '' });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!currentAccount || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await labelsApi.update(currentAccount.accountId, editing.id, form);
        toast({ title: 'Label atualizada' });
      } else {
        await labelsApi.create(currentAccount.accountId, form);
        toast({ title: 'Label criada' });
      }
      setDialogOpen(false);
      fetchLabels();
    } catch {
      toast({ title: 'Erro ao salvar label', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentAccount || !deleting) return;
    try {
      await labelsApi.remove(currentAccount.accountId, deleting.id);
      toast({ title: 'Label removida' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchLabels();
    } catch {
      toast({ title: 'Erro ao remover label', variant: 'destructive' });
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
        <h1 className="text-xl font-semibold">Labels</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova label
        </Button>
      </div>

      {labels.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Nenhuma label"
          description="Crie labels para organizar suas conversas."
        >
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Criar label
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: label.color }}
                  />
                  <div>
                    <p className="font-medium text-sm">{label.name}</p>
                    {label.description && (
                      <p className="text-xs text-muted-foreground">{label.description}</p>
                    )}
                  </div>
                  {label._count?.conversationLabels !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {label._count.conversationLabels} conversa(s)
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(label)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeleting(label);
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
            <DialogTitle>{editing ? 'Editar label' : 'Nova label'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da label"
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Cor</FormLabel>
              <div className="flex gap-2">
                {defaultColors.map((c) => (
                  <button
                    key={c}
                    className="h-8 w-8 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? 'white' : 'transparent',
                      transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <FormLabel>Descrição (opcional)</FormLabel>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição da label"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover label"
        description={`Tem certeza que deseja remover a label "${deleting?.name}"?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
