'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { treeflowsApi } from '@/lib/api/treeflows';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Upload, Loader2 } from 'lucide-react';
import type { TreeFlow } from '@/types/api';

export default function TreeFlowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const treeFlowId = params.treeFlowId as string;
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const { toast } = useToast();
  const [treeflow, setTreeflow] = useState<TreeFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [definitionJson, setDefinitionJson] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetchTreeflow = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const result = await treeflowsApi.get(currentAccount.accountId, treeFlowId);
      setTreeflow(result.data);
      if (result.data.activeVersion) {
        setDefinitionJson(JSON.stringify(result.data.activeVersion.definition, null, 2));
      }
    } catch (err) {
      console.error('Failed to fetch treeflow', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, treeFlowId]);

  useEffect(() => {
    fetchTreeflow();
  }, [fetchTreeflow]);

  async function handleCreateVersion() {
    if (!currentAccount) return;
    setCreatingVersion(true);
    try {
      const definition = JSON.parse(definitionJson);
      await treeflowsApi.createVersion(currentAccount.accountId, treeFlowId, {
        definition,
        notes: 'Nova versão',
      });
      toast({ title: 'Versão criada' });
      fetchTreeflow();
    } catch (err: unknown) {
      toast({
        title: err instanceof SyntaxError ? 'JSON inválido' : 'Erro ao criar versão',
        variant: 'destructive',
      });
    } finally {
      setCreatingVersion(false);
    }
  }

  async function handlePublish(versionId: string) {
    if (!currentAccount) return;
    setPublishing(versionId);
    try {
      await treeflowsApi.publishVersion(currentAccount.accountId, treeFlowId, versionId);
      toast({ title: 'Versão publicada' });
      fetchTreeflow();
    } catch {
      toast({ title: 'Erro ao publicar', variant: 'destructive' });
    } finally {
      setPublishing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
      </div>
    );
  }

  if (!treeflow) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        TreeFlow não encontrado
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/treeflows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{treeflow.name}</h1>
            <code className="text-xs text-muted-foreground">{treeflow.slug}</code>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Definição (JSON)</CardTitle>
            <Button size="sm" onClick={handleCreateVersion} disabled={creatingVersion}>
              {creatingVersion ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Criar versão
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={definitionJson}
              onChange={(e) => setDefinitionJson(e.target.value)}
              className="font-mono text-xs min-h-[300px]"
              placeholder='{"steps": [...]}'
            />
          </CardContent>
        </Card>

        {treeflow.versions && treeflow.versions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Versões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {treeflow.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">v{v.versionNumber}</span>
                    <Badge variant={v.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                      {v.status}
                    </Badge>
                  </div>
                  {v.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePublish(v.id)}
                      disabled={publishing === v.id}
                    >
                      {publishing === v.id ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Upload className="h-3 w-3 mr-1" />
                      )}
                      Publicar
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
