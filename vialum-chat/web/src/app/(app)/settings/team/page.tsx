'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { usersApi } from '@/lib/api/users';
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
import { UsersRound, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TeamMember } from '@/types/api';

const roleLabels: Record<string, string> = {
  owner: 'Dono',
  admin: 'Admin',
  agent: 'Agente',
};

const availabilityLabels: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Ocupado',
};

export default function TeamSettingsPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState<TeamMember | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'agent' });
  const [editForm, setEditForm] = useState({ name: '', role: 'agent', availability: 'online' });
  const [saving, setSaving] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await usersApi.list(currentAccount.accountId);
      setMembers(result.data);
    } catch (err) {
      console.error('Failed to fetch members', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'agent' });
    setDialogOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditing(member);
    setEditForm({ name: member.user.name, role: member.role, availability: member.availability });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!currentAccount) return;
    setSaving(true);
    try {
      if (editing) {
        await usersApi.update(currentAccount.accountId, editing.userId, editForm);
        toast({ title: 'Membro atualizado' });
      } else {
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
        await usersApi.create(currentAccount.accountId, form);
        toast({ title: 'Membro adicionado' });
      }
      setDialogOpen(false);
      fetchMembers();
    } catch {
      toast({ title: 'Erro ao salvar membro', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!currentAccount || !deleting) return;
    try {
      await usersApi.remove(currentAccount.accountId, deleting.userId);
      toast({ title: 'Membro removido' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchMembers();
    } catch {
      toast({ title: 'Erro ao remover membro', variant: 'destructive' });
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
        <h1 className="text-xl font-semibold">Equipe</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Novo membro
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Nenhum membro"
          description="Adicione membros para sua equipe."
        >
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar membro
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{member.user.name}</p>
                  <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  <div className="flex gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabels[member.role] ?? member.role}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {availabilityLabels[member.availability] ?? member.availability}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(member)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeleting(member);
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
            <DialogTitle>{editing ? 'Editar membro' : 'Novo membro'}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel>Nome</FormLabel>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <FormLabel>Papel</FormLabel>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FormLabel>Disponibilidade</FormLabel>
                <Select value={editForm.availability} onValueChange={(v) => setEditForm({ ...editForm, availability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="busy">Ocupado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <FormLabel>Nome</FormLabel>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <FormLabel>E-mail</FormLabel>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
              <div className="space-y-2">
                <FormLabel>Senha</FormLabel>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-2">
                <FormLabel>Papel</FormLabel>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!editing && (!form.name.trim() || !form.email.trim() || !form.password.trim()))}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover membro"
        description={`Tem certeza que deseja remover "${deleting?.user.name}" da equipe?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
