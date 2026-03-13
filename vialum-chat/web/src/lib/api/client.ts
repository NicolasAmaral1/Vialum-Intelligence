import { getAccessToken, setAccessToken, setRefreshToken, getRefreshToken, clearTokens } from '@/lib/auth/tokens';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/chat';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

async function performRefresh(): Promise<{ accessToken: string; refreshToken: string }> {
  const rt = getRefreshToken();
  if (!rt) throw new ApiError(401, 'Sem refresh token', 'NO_REFRESH_TOKEN');

  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });

  if (!res.ok) {
    clearTokens();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new ApiError(401, 'Sessão expirada', 'REFRESH_FAILED');
  }

  const data = await res.json();
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<T> {
  const token = getAccessToken();
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && !_retried) {
    if (!refreshPromise) {
      refreshPromise = performRefresh().finally(() => { refreshPromise = null; });
    }
    await refreshPromise;
    return apiClient<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? 'Erro desconhecido', body.code);
  }

  return res.json();
}

export function accountPath(accountId: string, path: string): string {
  return `/api/v1/accounts/${accountId}/${path}`;
}

function toQueryString(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

export { toQueryString };
