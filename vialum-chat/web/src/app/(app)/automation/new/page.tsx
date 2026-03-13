'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { automationApi } from '@/lib/api/automation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label as FormLabel } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import type { AutomationCondition, AutomationAction } from '@/types/api';

const eventOptions = [
  { value: 'message_created', label: 'Mensagem criada' },
  { value: 'conversation_created', label: 'Conversa criada' },
  { value: 'conversation_status_changed', label: 'Status da conversa alterado' },
  { value: 'conversation_assigned', label: 'Conversa atribuída' },
];

const actionTypes = [
  { value: 'assign_agent', label: 'Atribuir agente' },
  { value: 'assign_label', label: 'Atribuir label' },
  { value: 'send_message', label: 'Enviar mensagem' },
  { value: 'change_status', label: 'Alterar status' },
  { value: 'start_treeflow', label: 'Iniciar TreeFlow' },
];

export default function NewAutomationPage() {
  const router = useRouter();
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    eventName: '',
    conditions: [] as AutomationCondition[],
    actions: [] as AutomationAction[],
  });

  function addCondition() {
    setForm({
      ...form,
      conditions: [
        ...form.conditions,
        { attribute: '', operator: 'equals' as const, value: '' },
      ],
    });
  }

  function removeCondition(index: number) {
    setForm({
      ...form,
      conditions: form.conditions.filter((_, i) => i !== index),
    });
  }

  function updateCondition(index: number, field: string, value: string) {
    const conditions = [...form.conditions];
    conditions[index] = { ...conditions[index], [field]: value };
    setForm({ ...form, conditions });
  }

  function addAction() {
    setForm({
      ...form,
      actions: [...form.actions, { type: 'send_message' as const, params: {} }],
    });
  }

  function removeAction(index: number) {
    setForm({
      ...form,
      actions: form.actions.filter((_, i) => i !== index),
    });
  }

  function updateAction(index: number, field: string, value: string) {
    const actions = [...form.actions];
    if (field === 'type') {
      actions[index] = { type: value as AutomationAction['type'], params: {} };
    } else {
      actions[index] = { ...actions[index], params: { ...actions[index].params, [field]: value } };
    }
    setForm({ ...form, actions });
  }

  async function handleSave() {
    if (!currentAccount || !form.name.trim() || !form.eventName) return;
    setSaving(true);
    try {
      await automationApi.create(currentAccount.accountId, form);
      toast({ title: 'Regra criada' });
      router.push('/automation');
    } catch {
      toast({ title: 'Erro ao criar regra', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push('/automation')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Nova regra de automação</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nome da regra"
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Descrição (opcional)</FormLabel>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição da regra"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Evento</FormLabel>
              <Select value={form.eventName} onValueChange={(v) => setForm({ ...form, eventName: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o evento" />
                </SelectTrigger>
                <SelectContent>
                  {eventOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Condições</CardTitle>
            <Button size="sm" variant="outline" onClick={addCondition}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.conditions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma condição. A regra será executada para todos os eventos.</p>
            )}
            {form.conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    placeholder="Atributo (ex: content)"
                    value={cond.attribute}
                    onChange={(e) => updateCondition(i, 'attribute', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Select value={cond.operator} onValueChange={(v) => updateCondition(i, 'operator', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Igual</SelectItem>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="starts_with">Começa com</SelectItem>
                      <SelectItem value="not_equals">Diferente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Valor"
                    value={cond.value || ''}
                    onChange={(e) => updateCondition(i, 'value', e.target.value)}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeCondition(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Ações</CardTitle>
            <Button size="sm" variant="outline" onClick={addAction}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.actions.length === 0 && (
              <p className="text-sm text-muted-foreground">Adicione pelo menos uma ação.</p>
            )}
            {form.actions.map((action, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="w-48">
                  <Select value={action.type} onValueChange={(v) => updateAction(i, 'type', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actionTypes.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    placeholder="Valor do parâmetro"
                    value={(action.params?.value as string) || ''}
                    onChange={(e) => updateAction(i, 'value', e.target.value)}
                  />
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => removeAction(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => router.push('/automation')}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.eventName}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar regra
          </Button>
        </div>
      </div>
    </div>
  );
}
