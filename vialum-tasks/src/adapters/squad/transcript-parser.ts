import type { TranscriptEntry } from '../adapter.interface.js';

/**
 * Tools whose calls/results we consider "significant" (worth persisting to DB).
 * Read/Glob/Grep are noise — filtered from DB but still streamed to UI.
 */
const SIGNIFICANT_TOOLS = new Set([
  'Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch',
  'Agent', 'NotebookEdit', 'Skill',
]);

const MCP_TOOL_PREFIX = 'mcp__';
const MAX_TOOL_RESULT_LENGTH = 2000;

interface StreamJsonEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  model?: string;
  message?: {
    role?: string;
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  tool_name?: string;
  tool_input?: unknown;
  tool_result?: unknown;
  result?: string;
  error?: unknown;
  cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  duration_ms?: number;
  [key: string]: unknown;
}

export interface ParsedTranscript {
  entry: TranscriptEntry;
  isSignificant: boolean;
  capturedSessionId?: string;
}

/**
 * Parse a single stream-json line into a typed TranscriptEntry.
 */
export function parseLine(line: string): ParsedTranscript | null {
  let event: StreamJsonEvent;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  const ts = new Date().toISOString();

  // Init — contains session_id and model
  if (event.type === 'system' && event.session_id) {
    return {
      entry: { kind: 'init', sessionId: event.session_id, model: event.model, ts },
      isSignificant: true,
      capturedSessionId: event.session_id,
    };
  }

  // Assistant text message
  if (event.type === 'assistant' && event.message?.content) {
    const textBlocks = event.message.content
      .filter((b) => b.type === 'text' && b.text)
      .map((b) => b.text)
      .join('');

    if (textBlocks) {
      return {
        entry: { kind: 'message', text: textBlocks, ts },
        isSignificant: true,
      };
    }

    // Thinking blocks
    const thinkingBlocks = event.message.content
      .filter((b) => b.type === 'thinking' && b.text)
      .map((b) => b.text)
      .join('');

    if (thinkingBlocks) {
      return {
        entry: { kind: 'thinking', text: thinkingBlocks, ts },
        isSignificant: false,
      };
    }
  }

  // Tool use
  if (event.type === 'tool_use' || event.subtype === 'tool_use') {
    const name = event.tool_name ?? (event as Record<string, unknown>).name as string ?? 'unknown';
    const isMcp = name.startsWith(MCP_TOOL_PREFIX);
    const isSignificant = isMcp || SIGNIFICANT_TOOLS.has(name);
    const input = event.tool_input != null
      ? (typeof event.tool_input === 'string' ? event.tool_input : JSON.stringify(event.tool_input))
      : '';

    return {
      entry: { kind: 'tool_call', name, input: truncate(input, MAX_TOOL_RESULT_LENGTH), ts },
      isSignificant,
    };
  }

  // Tool result
  if (event.type === 'tool_result' || event.subtype === 'tool_result') {
    const name = event.tool_name ?? 'unknown';
    const isMcp = name.startsWith(MCP_TOOL_PREFIX);
    const isSignificant = isMcp || SIGNIFICANT_TOOLS.has(name);
    const content = event.tool_result != null
      ? (typeof event.tool_result === 'string' ? event.tool_result : JSON.stringify(event.tool_result))
      : '';
    const truncated = content.length > MAX_TOOL_RESULT_LENGTH;

    return {
      entry: {
        kind: 'tool_result',
        name,
        content: truncate(content, MAX_TOOL_RESULT_LENGTH),
        truncated,
        ts,
      },
      isSignificant,
    };
  }

  // Final result (includes cost and usage)
  if (event.type === 'result') {
    const entries: ParsedTranscript[] = [];

    if (event.usage || event.cost_usd != null) {
      return {
        entry: {
          kind: 'cost',
          inputTokens: event.usage?.input_tokens ?? 0,
          outputTokens: event.usage?.output_tokens ?? 0,
          costUsd: event.cost_usd ?? 0,
          ts,
        },
        isSignificant: true,
      };
    }

    return {
      entry: { kind: 'message', text: truncate(String(event.result ?? ''), 5000), ts },
      isSignificant: true,
    };
  }

  // Error
  if (event.type === 'error') {
    return {
      entry: { kind: 'error', message: String(event.error ?? event.message ?? 'unknown error'), ts },
      isSignificant: true,
    };
  }

  return null;
}

/**
 * Buffered line parser for chunked stdout data.
 * Handles incomplete lines across chunks.
 */
export class TranscriptParser {
  private buffer = '';

  /**
   * Feed a chunk of stdout data. Returns parsed transcript entries.
   */
  feed(chunk: Buffer | string): ParsedTranscript[] {
    const raw = this.buffer + chunk.toString();
    const lines = raw.split('\n');
    this.buffer = lines.pop() ?? '';

    const results: ParsedTranscript[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parsed = parseLine(line);
      if (parsed) results.push(parsed);
    }
    return results;
  }

  /**
   * Flush remaining buffer (on process exit).
   */
  flush(): ParsedTranscript[] {
    if (!this.buffer.trim()) {
      this.buffer = '';
      return [];
    }
    const parsed = parseLine(this.buffer);
    this.buffer = '';
    return parsed ? [parsed] : [];
  }
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...[truncated]' : str;
}
