const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vialum_token') : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vialum_token');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Definitions
  getDefinitions: () => apiFetch<{ data: Definition[] }>('/tasks/api/v1/definitions'),

  // Workflows
  getWorkflows: (params?: string) => apiFetch<PaginatedResponse<Workflow>>(`/tasks/api/v1/workflows${params ? `?${params}` : ''}`),
  getWorkflow: (id: string) => apiFetch<{ data: Workflow }>(`/tasks/api/v1/workflows/${id}`),
  createWorkflow: (body: Record<string, unknown>) => apiFetch<{ data: Workflow }>('/tasks/api/v1/workflows', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkflow: (id: string, body: Record<string, unknown>) => apiFetch<{ data: Workflow }>(`/tasks/api/v1/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkflow: (id: string) => apiFetch(`/tasks/api/v1/workflows/${id}`, { method: 'DELETE' }),
  getWorkflowEvents: (id: string, limit = 100) => apiFetch<{ data: WorkflowEvent[] }>(`/tasks/api/v1/workflows/${id}/events?limit=${limit}`),

  // Approvals
  getApprovals: (params?: string) => apiFetch<PaginatedResponse<Approval>>(`/tasks/api/v1/approvals${params ? `?${params}` : ''}`),
  decideApproval: (id: string, body: Record<string, unknown>) => apiFetch<{ data: Approval }>(`/tasks/api/v1/approvals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Commands
  sendCommand: (workflowId: string, command: string) => apiFetch<{ data: Command; queued?: boolean }>(`/tasks/api/v1/commands/${workflowId}`, { method: 'POST', body: JSON.stringify({ command }) }),
};

// Types
export interface Definition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  squad: string | null;
  stages: Array<{ id: string; label: string; position: number }>;
  commands: Array<{ label: string; command: string; icon?: string }>;
  dataSchema: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  accountId: string;
  definitionId: string;
  sessionId: string | null;
  stage: string;
  status: string;
  clientData: Record<string, unknown>;
  context: Record<string, unknown>;
  contactPhone: string | null;
  conversationId: string | null;
  externalTaskId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  definition?: Definition;
  approvals?: Approval[];
}

export interface Approval {
  id: string;
  workflowId: string;
  step: string;
  title: string;
  description: string | null;
  attachments: Array<{ name: string; url: string; type: string }>;
  formSchema: Record<string, unknown> | null;
  formData: Record<string, unknown> | null;
  status: string;
  decidedBy: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  workflow?: Partial<Workflow>;
}

export interface WorkflowEvent {
  id: string;
  eventType: string;
  toolName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export interface Command {
  id: string;
  command: string;
  sentBy: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
