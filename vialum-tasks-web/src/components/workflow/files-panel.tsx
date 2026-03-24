'use client';
import type { WorkflowEvent } from '@/lib/api';

interface Props {
  events: WorkflowEvent[];
}

interface FileRef {
  name: string;
  path?: string;
  type: string;
}

export function FilesPanel({ events }: Props) {
  // Extract file references from events (Bash outputs, tool results mentioning .pdf, .docx, etc.)
  const files = extractFiles(events);

  if (files.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Arquivos</h3>
        <p className="text-xs text-muted-foreground/50 italic">Nenhum arquivo gerado ainda</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Arquivos ({files.length})
      </h3>
      <div className="space-y-1.5">
        {files.map((file, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 p-2 rounded-md border border-border hover:bg-muted/30 transition-colors"
          >
            <FileIcon type={file.type} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
              {file.path && (
                <p className="text-[10px] text-muted-foreground/50 truncate">{file.path}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function extractFiles(events: WorkflowEvent[]): FileRef[] {
  const files: FileRef[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const payload = event.payload as Record<string, unknown> | null;
    if (!payload) continue;

    // Check tool results for file patterns
    const result = (payload.result as string) || '';
    const text = (payload.text as string) || '';
    const combined = `${result} ${text}`;

    const filePattern = /([A-Za-z0-9_\-]+\.(pdf|docx|xlsx|png|jpg|csv))/gi;
    let match;
    while ((match = filePattern.exec(combined)) !== null) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        files.push({
          name,
          type: match[2].toLowerCase(),
        });
      }
    }
  }

  return files;
}

function FileIcon({ type }: { type: string }) {
  const color = type === 'pdf' ? 'text-danger' : type === 'docx' ? 'text-[hsl(220,80%,60%)]' : 'text-muted-foreground';
  return (
    <svg className={`w-4 h-4 ${color} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
