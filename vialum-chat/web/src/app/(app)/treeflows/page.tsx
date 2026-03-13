'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { treeflowsApi } from '@/lib/api/treeflows';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { GitBranch, Plus } from 'lucide-react';
import type { TreeFlow } from '@/types/api';

export default function TreeFlowsPage() {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const router = useRouter();
  const [treeflows, setTreeflows] = useState<TreeFlow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTreeflows = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await treeflowsApi.list(currentAccount.accountId);
      setTreeflows(result.data);
    } catch (err) {
      console.error('Failed to fetch treeflows', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount]);

  useEffect(() => {
    fetchTreeflows();
  }, [fetchTreeflows]);

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
        <h1 className="text-xl font-semibold">TreeFlows</h1>
        <Button size="sm" onClick={() => router.push('/treeflows/new')}>
          <Plus className="h-4 w-4 mr-1" />
          Novo TreeFlow
        </Button>
      </div>

      {treeflows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Nenhum TreeFlow"
          description="TreeFlows definem fluxos de conversa guiados por IA."
        >
          <Button size="sm" onClick={() => router.push('/treeflows/new')}>
            <Plus className="h-4 w-4 mr-1" />
            Criar TreeFlow
          </Button>
        </EmptyState>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid gap-3">
            {treeflows.map((tf) => (
              <div
                key={tf.id}
                className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-accent/50"
                onClick={() => router.push(`/treeflows/${tf.id}`)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{tf.name}</p>
                    {tf.isArchived && (
                      <Badge variant="secondary" className="text-[10px]">Arquivado</Badge>
                    )}
                  </div>
                  {tf.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{tf.description}</p>
                  )}
                  <div className="flex gap-2 mt-1.5">
                    <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {tf.slug}
                    </code>
                    {tf.category && (
                      <Badge variant="outline" className="text-[10px]">{tf.category}</Badge>
                    )}
                    {tf.activeVersion && (
                      <Badge variant="default" className="text-[10px]">
                        v{tf.activeVersion.versionNumber}
                      </Badge>
                    )}
                  </div>
                </div>
                <RelativeTime date={tf.updatedAt} className="text-xs text-muted-foreground" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
