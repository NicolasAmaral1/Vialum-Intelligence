'use client';
import { create } from 'zustand';
import { api, type Workflow, type WorkflowEvent } from '@/lib/api';

interface WorkflowDetailState {
  workflow: Workflow | null;
  events: WorkflowEvent[];
  loading: boolean;
  error: string | null;
  terminalLines: TerminalLine[];

  fetch: (id: string) => Promise<void>;
  setWorkflow: (w: Partial<Workflow>) => void;
  addEvent: (e: WorkflowEvent) => void;
  addTerminalLine: (line: TerminalLine) => void;
  clearTerminal: () => void;
}

export interface TerminalLine {
  id: string;
  type: 'assistant' | 'tool' | 'result' | 'error' | 'system' | 'user' | 'thinking' | 'cost';
  content: string;
  toolName?: string;
  timestamp: string;
}

export interface TranscriptEntry {
  kind: 'init' | 'thinking' | 'message' | 'tool_call' | 'tool_result' | 'cost' | 'error' | 'status';
  text?: string;
  message?: string;
  name?: string;
  input?: string;
  content?: string;
  truncated?: boolean;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  sessionId?: string;
  model?: string;
  ts: string;
}

export function transcriptToLine(entry: TranscriptEntry, stepId?: string): TerminalLine | null {
  const id = `tr-${stepId || ''}-${entry.ts}-${Math.random().toString(36).slice(2, 6)}`;

  switch (entry.kind) {
    case 'thinking':
      return { id, type: 'thinking', content: entry.text || '', timestamp: entry.ts };
    case 'message':
      return { id, type: 'assistant', content: entry.text || '', timestamp: entry.ts };
    case 'tool_call':
      return { id, type: 'tool', content: `${entry.name}(${truncate(entry.input || '', 200)})`, toolName: entry.name, timestamp: entry.ts };
    case 'tool_result':
      return { id, type: 'result', content: truncate(entry.content || 'OK', 300), toolName: entry.name, timestamp: entry.ts };
    case 'cost':
      return { id, type: 'cost', content: `Tokens: ${entry.inputTokens?.toLocaleString()}↑ ${entry.outputTokens?.toLocaleString()}↓ | Custo: $${entry.costUsd?.toFixed(4)}`, timestamp: entry.ts };
    case 'error':
      return { id, type: 'error', content: entry.message || 'Erro', timestamp: entry.ts };
    case 'status':
      return { id, type: 'system', content: entry.text || '', timestamp: entry.ts };
    case 'init':
      return { id, type: 'system', content: `Sessao iniciada${entry.model ? ` (${entry.model})` : ''}`, timestamp: entry.ts };
    default:
      return null;
  }
}

export const useWorkflowDetail = create<WorkflowDetailState>((set, get) => ({
  workflow: null,
  events: [],
  loading: false,
  error: null,
  terminalLines: [],

  fetch: async (id) => {
    set({ loading: true, error: null });
    try {
      const [wfRes, eventsRes] = await Promise.all([
        api.getWorkflow(id),
        api.getWorkflowEvents(id, 200),
      ]);

      // Convert past events to terminal lines
      const lines: TerminalLine[] = eventsRes.data
        .reverse()
        .map((e) => eventToTerminalLine(e))
        .filter(Boolean) as TerminalLine[];

      set({
        workflow: wfRes.data,
        events: eventsRes.data,
        terminalLines: lines,
        loading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load', loading: false });
    }
  },

  setWorkflow: (data) => {
    set((s) => ({ workflow: s.workflow ? { ...s.workflow, ...data } : null }));
  },

  addEvent: (e) => {
    const line = eventToTerminalLine(e);
    set((s) => ({
      events: [e, ...s.events],
      terminalLines: line ? [...s.terminalLines, line] : s.terminalLines,
    }));
  },

  addTerminalLine: (line) => {
    set((s) => ({ terminalLines: [...s.terminalLines, line] }));
  },

  clearTerminal: () => set({ terminalLines: [] }),
}));

function eventToTerminalLine(e: WorkflowEvent): TerminalLine | null {
  const payload = e.payload as Record<string, unknown> | null;

  switch (e.eventType) {
    case 'assistant.message':
      return {
        id: e.id,
        type: 'assistant',
        content: (payload?.text as string) || '',
        timestamp: e.createdAt,
      };
    case 'tool.call':
      return {
        id: e.id,
        type: 'tool',
        content: `Chamando ${e.toolName}`,
        toolName: e.toolName || undefined,
        timestamp: e.createdAt,
      };
    case 'tool.result':
      return {
        id: e.id,
        type: 'result',
        content: truncate((payload?.result as string) || 'OK', 300),
        toolName: e.toolName || undefined,
        timestamp: e.createdAt,
      };
    case 'session.result':
      return {
        id: e.id,
        type: 'system',
        content: (payload?.result as string) || 'Sessão finalizada',
        timestamp: e.createdAt,
      };
    case 'session.error':
      return {
        id: e.id,
        type: 'error',
        content: (payload?.error as string) || 'Erro na sessão',
        timestamp: e.createdAt,
      };
    case 'session.end':
      return {
        id: e.id,
        type: 'system',
        content: `Sessão encerrada (${(payload?.status as string) || 'unknown'})`,
        timestamp: e.createdAt,
      };
    case 'chat.message_received':
      return {
        id: e.id,
        type: 'user',
        content: `Cliente: ${(payload?.content as string) || '(mídia)'}`,
        timestamp: e.createdAt,
      };
    default:
      return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '...' : s;
}
