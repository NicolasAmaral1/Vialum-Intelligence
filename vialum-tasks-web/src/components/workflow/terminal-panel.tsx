'use client';
import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useWorkflowDetail, type TerminalLine } from '@/stores/workflow';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  workflowId: string;
  commands?: Array<{ label: string; command: string; icon?: string }>;
}

export function TerminalPanel({ workflowId, commands = [] }: Props) {
  const { terminalLines, addTerminalLine } = useWorkflowDetail();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [terminalLines.length]);

  const sendCommand = async (command: string) => {
    if (!command.trim()) return;

    // Optimistic: show user command in terminal
    addTerminalLine({
      id: `cmd-${Date.now()}`,
      type: 'user',
      content: command,
      timestamp: new Date().toISOString(),
    });

    setSending(true);
    try {
      const res = await api.sendCommand(workflowId, command);
      if (res.queued) {
        addTerminalLine({
          id: `sys-${Date.now()}`,
          type: 'system',
          content: 'Comando enfileirado — Claude está ocupado',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      addTerminalLine({
        id: `err-${Date.now()}`,
        type: 'error',
        content: err instanceof Error ? err.message : 'Erro ao enviar',
        timestamp: new Date().toISOString(),
      });
    }
    setSending(false);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCommand(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Terminal</h3>

      {/* Output */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-lg bg-[hsl(220,16%,10%)] border border-border p-3 space-y-1.5 font-mono text-xs"
      >
        {terminalLines.length === 0 && (
          <p className="text-muted-foreground/40 italic">Nenhum evento ainda...</p>
        )}
        {terminalLines.map((line) => (
          <TerminalLineRow key={line.id} line={line} />
        ))}
      </div>

      {/* Quick actions */}
      {commands.length > 0 && (
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {commands.map((cmd) => (
            <button
              key={cmd.command}
              onClick={() => sendCommand(cmd.command)}
              disabled={sending}
              className="px-2.5 py-1 text-[11px] font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Comando ou mensagem..."
          disabled={sending}
          className="flex-1 px-3 py-2 text-sm bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
        />
        <button
          onClick={() => sendCommand(input)}
          disabled={sending || !input.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function TerminalLineRow({ line }: { line: TerminalLine }) {
  const colorMap: Record<string, string> = {
    assistant: 'text-foreground',
    tool: 'text-muted-foreground',
    result: 'text-muted-foreground/60',
    error: 'text-danger',
    system: 'text-primary/70',
    user: 'text-[hsl(var(--warning))]',
  };

  const prefixMap: Record<string, string> = {
    assistant: '🤖',
    tool: '🔧',
    result: '  ↳',
    error: '❌',
    system: '⚙️',
    user: '👤',
  };

  return (
    <div className={cn('leading-relaxed whitespace-pre-wrap break-words', colorMap[line.type] || 'text-foreground')}>
      <span className="select-none mr-1.5">{prefixMap[line.type] || '•'}</span>
      {line.toolName && <span className="text-muted-foreground/50">[{line.toolName}] </span>}
      {line.content}
    </div>
  );
}
