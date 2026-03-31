/**
 * Adapter Interface — Model-agnostic execution layer
 *
 * Executors (ai, human, system, client) define WHO does the work.
 * Adapters (squad, sdk, langchain, script, human, wait) define HOW.
 *
 * Simple adapters implement ExecutionAdapter.execute().
 * Session-aware adapters (squad) implement SessionAwareAdapter with lifecycle management.
 */

// ─── Transcript (streamed from adapter to UI via WebSocket) ─────────

export type TranscriptEntry =
  | { kind: 'init'; sessionId: string; model?: string; ts: string }
  | { kind: 'thinking'; text: string; ts: string }
  | { kind: 'message'; text: string; ts: string }
  | { kind: 'tool_call'; name: string; input: string; ts: string }
  | { kind: 'tool_result'; name: string; content: string; truncated: boolean; ts: string }
  | { kind: 'cost'; inputTokens: number; outputTokens: number; costUsd: number; ts: string }
  | { kind: 'error'; message: string; ts: string }
  | { kind: 'status'; text: string; ts: string };

export type LogCallback = (entry: TranscriptEntry) => void;

// ─── Step I/O ───────────────────────────────────────────────────────

export interface StepInput {
  stepId: string;
  definitionStepId: string;
  prompt: string;
  input: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface StepResult {
  success: boolean;
  output: Record<string, unknown>;
  usage: UsageInfo | null;
  error: string | null;
}

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  modelId: string;
  costUsd: number;
  durationMs: number;
}

// ─── Session Handle (for session-aware adapters) ────────────────────

export interface SessionHandle {
  /** task_sessions.id in DB */
  sessionId: string;
  /** Opaque ID from adapter (e.g., Claude CLI session UUID). Stored as-is, never reconstructed. */
  adapterSessionId: string;
  /** OS process ID, if applicable */
  pid?: number;
}

// ─── Adapter Context ────────────────────────────────────────────────

export interface AdapterContext {
  executionId: string;
  workflowId: string;
  stepId: string;
  accountId: string;
  adapterConfig: Record<string, unknown>;
  input: Record<string, unknown>;
  prompt: string;
  outputSchema?: Record<string, unknown>;
  onLog: LogCallback;
  abortSignal: AbortSignal;
}

export interface SessionStartContext {
  workflowId: string;
  taskId: string;
  accountId: string;
  adapterConfig: Record<string, unknown>;
  cwd: string;
}

// ─── ExecutionAdapter (stateless — SDK, script, langchain) ──────────

export interface ExecutionAdapter {
  readonly type: string;
  readonly displayName: string;

  execute(ctx: AdapterContext): Promise<StepResult>;

  validateConfig(config: Record<string, unknown>): Promise<{
    valid: boolean;
    errors: string[];
  }>;
}

// ─── SessionAwareAdapter (stateful — squad/Claude CLI) ──────────────

export interface SessionAwareAdapter extends ExecutionAdapter {
  /**
   * Spawn a new adapter process (e.g., Claude CLI).
   * Session lives for the duration of a Task (multiple steps).
   */
  startSession(ctx: SessionStartContext): Promise<SessionHandle>;

  /**
   * Execute a step within an active session.
   * Sends prompt to the running process, streams transcript via onLog.
   */
  executeStep(
    handle: SessionHandle,
    step: StepInput,
    onLog: LogCallback,
  ): Promise<StepResult>;

  /**
   * Pause session — save adapterSessionId, kill process.
   * Called when next step is human or client (bola sai do adapter).
   */
  pauseSession(handle: SessionHandle): Promise<void>;

  /**
   * Resume a paused session — spawn process with --resume adapterSessionId.
   * Returns new handle (new PID, same adapterSessionId).
   */
  resumeSession(handle: SessionHandle, ctx: SessionStartContext): Promise<SessionHandle>;

  /**
   * End session — final cleanup when Task completes.
   */
  endSession(handle: SessionHandle): Promise<void>;
}

// ─── Type guard ─────────────────────────────────────────────────────

export function isSessionAware(adapter: ExecutionAdapter): adapter is SessionAwareAdapter {
  return 'startSession' in adapter && 'executeStep' in adapter;
}
