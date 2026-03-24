import { getPrisma } from '../config/database.js';
import { broadcastToWorkflow, broadcastToAccount } from '../plugins/websocket.js';

/**
 * Events from Claude CLI --output-format stream-json that we care about.
 * We filter noise (Read, Glob, Grep) and only persist meaningful events.
 */
const SIGNIFICANT_TOOLS = new Set([
  'Bash', 'Edit', 'Write', 'WebFetch', 'WebSearch',
  'Agent', 'NotebookEdit', 'Skill',
]);

const MCP_TOOL_PREFIX = 'mcp__';

interface StreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    role?: string;
    content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  };
  tool_name?: string;
  tool_input?: unknown;
  tool_result?: unknown;
  result?: string;
  // stream-json may include other fields
  [key: string]: unknown;
}

export interface ProcessedEvent {
  eventType: string;
  toolName: string | null;
  payload: Record<string, unknown>;
  isSignificant: boolean;
}

/**
 * Parse a single stream-json line into a ProcessedEvent.
 * Returns null if the line is not parseable or is noise.
 */
export function parseStreamEvent(line: string): ProcessedEvent | null {
  let event: StreamEvent;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  // Init message — contains session_id
  if (event.type === 'system' && event.session_id) {
    return {
      eventType: 'session.init',
      toolName: null,
      payload: { sessionId: event.session_id },
      isSignificant: true,
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
        eventType: 'assistant.message',
        toolName: null,
        payload: { text: textBlocks },
        isSignificant: true,
      };
    }
  }

  // Tool use (Claude is calling a tool)
  if (event.type === 'tool_use' || event.subtype === 'tool_use') {
    const toolName = event.tool_name ?? (event as Record<string, unknown>).name as string ?? 'unknown';
    const isMcp = toolName.startsWith(MCP_TOOL_PREFIX);
    const isSignificant = isMcp || SIGNIFICANT_TOOLS.has(toolName);

    return {
      eventType: 'tool.call',
      toolName,
      payload: {
        input: isSignificant ? event.tool_input : undefined,
        isMcp,
      },
      isSignificant,
    };
  }

  // Tool result
  if (event.type === 'tool_result' || event.subtype === 'tool_result') {
    const toolName = event.tool_name ?? 'unknown';
    const isMcp = toolName.startsWith(MCP_TOOL_PREFIX);
    const isSignificant = isMcp || SIGNIFICANT_TOOLS.has(toolName);

    return {
      eventType: 'tool.result',
      toolName,
      payload: {
        // Only persist result for significant tools (avoid huge payloads from Read/Grep)
        result: isSignificant ? truncate(event.tool_result, 2000) : undefined,
        isMcp,
      },
      isSignificant,
    };
  }

  // Final result
  if (event.type === 'result') {
    return {
      eventType: 'session.result',
      toolName: null,
      payload: { result: truncate(event.result, 5000) },
      isSignificant: true,
    };
  }

  // Error
  if (event.type === 'error') {
    return {
      eventType: 'session.error',
      toolName: null,
      payload: { error: String(event.error ?? event.message ?? 'unknown error') },
      isSignificant: true,
    };
  }

  return null;
}

/**
 * Processes a raw chunk from Claude CLI stdout.
 * Splits into lines, parses each, persists significant events, broadcasts all.
 */
export class OutputProcessor {
  private buffers = new Map<string, string>();

  async processChunk(workflowId: string, accountId: string, chunk: Buffer | string): Promise<string | null> {
    const raw = (this.buffers.get(workflowId) ?? '') + chunk.toString();
    const lines = raw.split('\n');

    // Last element may be incomplete — buffer it
    this.buffers.set(workflowId, lines.pop() ?? '');

    let capturedSessionId: string | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      const event = parseStreamEvent(line);
      if (!event) continue;

      // Capture session_id from init event
      if (event.eventType === 'session.init' && event.payload.sessionId) {
        capturedSessionId = event.payload.sessionId as string;
      }

      // Persist significant events to DB
      if (event.isSignificant) {
        try {
          const prisma = getPrisma();
          await prisma.workflowEvent.create({
            data: {
              accountId,
              workflowId,
              eventType: event.eventType,
              toolName: event.toolName,
              payload: event.payload as Record<string, string | number | boolean | null>,
            },
          });
        } catch (err) {
          console.error(`[output-processor] DB write failed for ${workflowId}:`, err);
        }
      }

      // Broadcast ALL events via Socket.IO (including non-significant for live terminal)
      broadcastToWorkflow(workflowId, 'workflow:event', {
        workflowId,
        eventType: event.eventType,
        toolName: event.toolName,
        payload: event.payload,
        timestamp: new Date().toISOString(),
      });
    }

    return capturedSessionId;
  }

  flush(workflowId: string) {
    this.buffers.delete(workflowId);
  }
}

function truncate(value: unknown, maxLen: number): string | undefined {
  if (value == null) return undefined;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return str.length > maxLen ? str.slice(0, maxLen) + '...[truncated]' : str;
}
