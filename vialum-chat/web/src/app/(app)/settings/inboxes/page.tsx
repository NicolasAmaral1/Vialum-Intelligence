'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { inboxesApi } from '@/lib/api/inboxes';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Inbox, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Inbox as InboxType } from '@/types/api';

export default function InboxesSettingsPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [inboxes, setInboxes] = useState<InboxType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InboxType | null>(null);
  const [deleting, setDeleting] = useState<InboxType | null>(null);
  const [form, setForm] = useState({ name: '', channelType: 'whatsapp', provider: 'evolution_api' });
  const [saving, setSaving] = useState(false);

  const fetchInboxes = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await inboxesApi.list(currentAccount.accountId);
      setInboxes(result.data);
    } catch (err) {
      console.error('Failed to fetch inboxes', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchInboxes();
  }, [fetchInboxes]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', channelType: 'whatsapp', provider: 'evolution_api' });
    setDialogOpen(true);
  }

  function openEdit(inbox: InboxType) {
    setEditing(inbox);
    setForm({ name: inbox.name, channelType: inbox.channelType, provider: inbox.provider });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!currentAccount || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await inboxesApi.update(currentAccount.accountId, editing.id, form);
        toast({ title: 'Inbox atualizada' });
      } else {
        await inboxesApi.create(currentAccount.accountId, form);
        toast({ title: 'Inbox criada' });
      }
      setDialogOpen(false);
      fetchInboxes();
    } catch {
      toast({ title: 'Erro ao salvar inbox', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentAccount || !deleting) return;
    try {
      await inboxesApi.remove(currentAccount.accountId, deleting.id);
      toast({ title: 'Inbox removida' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchInboxes();
    } catch {
      toast({ title: 'Erro ao remover inbox', variant: 'destructive' });
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
        <h1 className="text-xl font-semibold">Inboxes</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova inbox
        </Button>
      </div>

      {inboxes.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nenhuma inbox"
          description="Configure canais de comunicação."
        >
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Criar inbox
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {inboxes.map((inbox) => (
              <div key={inbox.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{inbox.name}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{inbox.channelType}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{inbox.provider}</Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(inbox)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeleting(inbox);
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
            <DialogTitle>{editing ? 'Editar inbox' : 'Nova inbox'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="WhatsApp Principal" />
            </div>
            <div className="space-y-2">
              <FormLabel>Canal</FormLabel>
              <Select value={form.channelType} onValueChange={(v) => setForm({ ...form, channelType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="webchat">Webchat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FormLabel>Provider</FormLabel>
              <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evolution_api">Evolution API</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                  <SelectItem value="smtp">SMTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
        title="Remover inbox"
        description={`Tem certeza que deseja remover "${deleting?.name}"?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
