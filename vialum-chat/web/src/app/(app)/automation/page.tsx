'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { automationApi } from '@/lib/api/automation';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Zap, Plus, Pencil, Trash2 } from 'lucide-react';
import type { AutomationRule } from '@/types/api';

export default function AutomationPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const router = useRouter();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<AutomationRule | null>(null);

  const fetchRules = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await automationApi.list(currentAccount.accountId);
      setRules(result.data);
    } catch (err) {
      console.error('Failed to fetch rules', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleToggle(rule: AutomationRule) {
    if (!currentAccount) return;
    try {
      await automationApi.toggle(currentAccount.accountId, rule.id);
      fetchRules();
    } catch {
      toast({ title: 'Erro ao alterar regra', variant: 'destructive' });
    }
  }

  async function handleDelete() {
    if (!currentAccount || !deleting) return;
    try {
      await automationApi.remove(currentAccount.accountId, deleting.id);
      toast({ title: 'Regra removida' });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchRules();
    } catch {
      toast({ title: 'Erro ao remover regra', variant: 'destructive' });
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
        <h1 className="text-xl font-semibold">Automação</h1>
        <Button size="sm" onClick={() => router.push('/automation/new')}>
          <Plus className="h-4 w-4 mr-1" />
          Nova regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma regra"
          description="Crie regras de automação para agilizar o atendimento."
        >
          <Button size="sm" onClick={() => router.push('/automation/new')}>
            <Plus className="h-4 w-4 mr-1" />
            Criar regra
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <Switch
                    checked={rule.active}
                    onCheckedChange={() => handleToggle(rule)}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{rule.name}</p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground truncate">{rule.description}</p>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">
                        {rule.eventName}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {rule.runCount} execuções
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => router.push(`/automation/${rule.id}/edit`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      setDeleting(rule);
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

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Remover regra"
        description={`Tem certeza que deseja remover "${deleting?.name}"?`}
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
