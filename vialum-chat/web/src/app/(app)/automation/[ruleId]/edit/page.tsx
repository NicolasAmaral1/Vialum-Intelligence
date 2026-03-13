'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
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

export default function EditAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const ruleId = params.ruleId as string;
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    eventName: '',
    conditions: [] as AutomationCondition[],
    actions: [] as AutomationAction[],
  });

  useEffect(() => {
    if (!currentAccount) return;
    automationApi.get(currentAccount.accountId, ruleId).then((result) => {
      const rule = result.data;
      setForm({
        name: rule.name,
        description: rule.description || '',
        eventName: rule.eventName,
        conditions: rule.conditions,
        actions: rule.actions,
      });
      setLoading(false);
    });
  }, [currentAccount, ruleId]);

  async function handleSave() {
    if (!currentAccount) return;
    setSaving(true);
    try {
      await automationApi.update(currentAccount.accountId, ruleId, form);
      toast({ title: 'Regra atualizada' });
      router.push('/automation');
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
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
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push('/automation')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Editar regra</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <FormLabel>Descrição</FormLabel>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <FormLabel>Evento</FormLabel>
              <Select value={form.eventName} onValueChange={(v) => setForm({ ...form, eventName: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Condições</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...form, conditions: [...form.conditions, { attribute: '', operator: 'equals', value: '' }] })}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.conditions.map((cond, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Input className="flex-1" placeholder="Atributo" value={cond.attribute} onChange={(e) => {
                  const c = [...form.conditions]; c[i] = { ...c[i], attribute: e.target.value }; setForm({ ...form, conditions: c });
                }} />
                <Select value={cond.operator} onValueChange={(v) => {
                  const c = [...form.conditions]; c[i] = { ...c[i], operator: v as AutomationCondition['operator'] }; setForm({ ...form, conditions: c });
                }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Igual</SelectItem>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="starts_with">Começa com</SelectItem>
                    <SelectItem value="not_equals">Diferente</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="Valor" value={cond.value || ''} onChange={(e) => {
                  const c = [...form.conditions]; c[i] = { ...c[i], value: e.target.value }; setForm({ ...form, conditions: c });
                }} />
                <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Ações</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setForm({ ...form, actions: [...form.actions, { type: 'send_message', params: {} }] })}>
              <Plus className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {form.actions.map((action, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Select value={action.type} onValueChange={(v) => {
                  const a = [...form.actions]; a[i] = { type: v as AutomationAction['type'], params: {} }; setForm({ ...form, actions: a });
                }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {actionTypes.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input className="flex-1" placeholder="Valor" value={(action.params?.value as string) || ''} onChange={(e) => {
                  const a = [...form.actions]; a[i] = { ...a[i], params: { ...a[i].params, value: e.target.value } }; setForm({ ...form, actions: a });
                }} />
                <Button size="icon" variant="ghost" onClick={() => setForm({ ...form, actions: form.actions.filter((_, idx) => idx !== i) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => router.push('/automation')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
