'use client';

interface Props {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for contract/report outputs.
 * Supports: headings, bold, italic, lists, horizontal rules, paragraphs.
 * No external dependencies.
 */
export function MarkdownView({ content, className = '' }: Props) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={key++} className="h-2" />);
      continue;
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed)) {
      elements.push(<hr key={key++} className="border-border/30 my-2" />);
      continue;
    }

    // Headings
    if (trimmed.startsWith('# ')) {
      elements.push(<h1 key={key++} className="text-base font-bold text-foreground mt-4 mb-1">{formatInline(trimmed.slice(2))}</h1>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-sm font-bold text-foreground mt-3 mb-1">{formatInline(trimmed.slice(3))}</h2>);
      continue;
    }
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-xs font-bold text-foreground mt-2 mb-0.5">{formatInline(trimmed.slice(4))}</h3>);
      continue;
    }

    // List items
    if (/^[a-z]\)/.test(trimmed) || /^\d+\./.test(trimmed) || trimmed.startsWith('- ')) {
      const text = trimmed.replace(/^[a-z]\)\s*/, '').replace(/^\d+\.\s*/, '').replace(/^-\s*/, '');
      elements.push(
        <div key={key++} className="text-xs text-foreground/80 pl-4 py-0.5 flex">
          <span className="text-muted-foreground/50 mr-2 flex-shrink-0">
            {/^[a-z]\)/.test(trimmed) ? trimmed.match(/^[a-z]\)/)?.[0] : /^\d+\./.test(trimmed) ? trimmed.match(/^\d+\./)?.[0] : '•'}
          </span>
          <span>{formatInline(text)}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={key++} className="text-xs text-foreground/80 leading-relaxed">{formatInline(trimmed)}</p>);
  }

  return <div className={`space-y-0 ${className}`}>{elements}</div>;
}

function formatInline(text: string): React.ReactNode {
  // Bold + italic patterns
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let partKey = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={partKey++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={partKey++} className="font-semibold text-foreground">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic: *text*
    const italicMatch = remaining.match(/\*(.+?)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(<span key={partKey++}>{remaining.slice(0, italicMatch.index)}</span>);
      }
      parts.push(<em key={partKey++} className="italic">{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    parts.push(<span key={partKey++}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
