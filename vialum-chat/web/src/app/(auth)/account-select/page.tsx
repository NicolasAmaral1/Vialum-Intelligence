'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { Building2, ChevronRight, LogOut, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function AccountSelectPage() {
  const router = useRouter();
  const { accounts, setAccount, logout } = useAuthStore();
  const [selecting, setSelecting] = useState<string | null>(null);

  function handleSelect(accountId: string, accountName: string, role: string) {
    setSelecting(accountId);
    setAccount({ accountId, accountName, role });
    router.push('/inbox');
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  if (!accounts || accounts.length === 0) {
    router.push('/login');
    return null;
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Building2 className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl">Selecionar conta</CardTitle>
        <CardDescription>Escolha a conta que deseja acessar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {accounts.map((acc) => (
          <Button
            key={acc.accountId}
            variant="outline"
            className="w-full justify-between h-auto py-3"
            disabled={selecting !== null}
            onClick={() => handleSelect(acc.accountId, acc.accountName, acc.role)}
          >
            <div className="text-left">
              <p className="font-medium">{acc.accountName}</p>
              <p className="text-xs text-muted-foreground capitalize">{acc.role}</p>
            </div>
            {selecting === acc.accountId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="w-full mt-4"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </CardContent>
    </Card>
  );
}
