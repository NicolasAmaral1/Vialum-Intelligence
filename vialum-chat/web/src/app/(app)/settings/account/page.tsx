'use client';

import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label as FormLabel } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function AccountSettingsPage() {
  const { user, currentAccount } = useAuthStore();

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-semibold">Configurações da Conta</h1>
      </div>

      <div className="flex-1 overflow-auto p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações do usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome</FormLabel>
              <Input value={user?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <FormLabel>E-mail</FormLabel>
              <Input value={user?.email || ''} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FormLabel>Nome da conta</FormLabel>
              <Input value={currentAccount?.accountName || ''} disabled />
            </div>
            <div className="space-y-2">
              <FormLabel>Papel</FormLabel>
              <Input value={currentAccount?.role || ''} disabled className="capitalize" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
