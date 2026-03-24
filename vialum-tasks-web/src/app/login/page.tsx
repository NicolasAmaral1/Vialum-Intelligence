'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';

export default function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Token obrigatório');
      return;
    }

    // Clean token: remove whitespace, newlines, quotes
    const cleanToken = token.replace(/[\s\n\r"']+/g, '');

    // Validate token by making a test API call
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';
      const res = await fetch(
        `${apiUrl}/tasks/api/v1/definitions`,
        { headers: { Authorization: `Bearer ${cleanToken}` } }
      );
      if (!res.ok) throw new Error(`API retornou ${res.status}: ${res.statusText}`);

      login(cleanToken);
      router.push('/inbox');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(`Falha: ${message}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">Vialum</span>
            <span className="text-foreground"> Tasks</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Hub operacional</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="token" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Token de acesso
            </label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole seu JWT token"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-danger">{error}</p>
          )}

          <button
            type="submit"
            className="w-full py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
