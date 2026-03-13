import { getAccessToken } from '@/lib/auth/tokens';
import type { ContactCrmSummary } from '@/types/crm';

const CRM_BASE = process.env.NEXT_PUBLIC_CRM_URL || 'https://api.luminai.ia.br/crm';

async function crmFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const url = `${CRM_BASE}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    // Non-critical — CRM Hub may be down or contact not linked
    return { data: null } as T;
  }

  return res.json();
}

export const crmApi = {
  getContactSummary: (vialumContactId: string, opts?: { phone?: string; name?: string; email?: string }) => {
    const params = new URLSearchParams();
    if (opts?.phone) params.set('phone', opts.phone);
    if (opts?.name) params.set('name', opts.name);
    if (opts?.email) params.set('email', opts.email);
    const qs = params.toString();
    return crmFetch<{ data: ContactCrmSummary }>(`/api/v1/contacts/${vialumContactId}/summary${qs ? `?${qs}` : ''}`);
  },

  lookupContact: (data: { vialumContactId: string; phone?: string; email?: string; name?: string }) =>
    crmFetch<{ data: unknown }>('/api/v1/contacts/lookup', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
