'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { treeflowsApi } from '@/lib/api/treeflows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label as FormLabel } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function NewTreeFlowPage() {
  const router = useRouter();
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    category: '',
  });

  async function handleSave() {
    if (!currentAccount || !form.name.trim() || !form.slug.trim()) return;
    setSaving(true);
    try {
      const result = await treeflowsApi.create(currentAccount.accountId, form);
      toast({ title: 'TreeFlow criado' });
      router.push(`/treeflows/${result.data.id}`);
    } catch {
      toast({ title: 'Erro ao criar TreeFlow', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b">
        <Button variant="ghost" size="icon" onClick={() => router.push('/treeflows')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold">Novo TreeFlow</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Fluxo de vendas"
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Slug</FormLabel>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="fluxo-de-vendas"
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Descrição (opcional)</FormLabel>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Categoria (opcional)</FormLabel>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="vendas"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 pb-6">
          <Button variant="outline" onClick={() => router.push('/treeflows')}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.slug.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Criar
          </Button>
        </div>
      </div>
    </div>
  );
}
