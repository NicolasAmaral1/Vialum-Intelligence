import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdirSync, existsSync, symlinkSync } from 'fs';
import { join } from 'path';
import { getPrisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { createHooksSettingsFile, removeHooksSettingsFile } from '../../session/hooks-config.js';
import { TranscriptParser } from './transcript-parser.js';
import type {
  SessionAwareAdapter,
  SessionHandle,
  SessionStartContext,
  StepInput,
  StepResult,
  UsageInfo,
  LogCallback,
  AdapterContext,
} from '../adapter.interface.js';

/**
 * Active processes keyed by task_sessions.id.
 * This is an in-memory index for fast lookup — the source of truth is task_sessions table.
 * On restart, orphaned sessions are marked 'orphaned' by the engine.
 */
const activeProcesses = new Map<string, {
  process: ChildProcess;
  adapterSessionId: string;
  parser: TranscriptParser;
}>();

export class SquadAdapter implements SessionAwareAdapter {
  readonly type = 'squad';
  readonly displayName = 'Claude CLI (Squad)';

  // ─── Session Lifecycle ──────────────────────────────────────────

  async startSession(ctx: SessionStartContext): Promise<SessionHandle> {
    const prisma = getPrisma();

    // Resolve workspace: squadRef → isolated case directory with symlinks
    const cwd = resolveWorkspace(ctx);

    // Create session record in DB (store cwd for later executeStep calls)
    const session = await prisma.taskSession.create({
      data: {
        accountId: ctx.accountId,
        workflowId: ctx.workflowId,
        taskId: ctx.taskId,
        adapterType: this.type,
        status: 'active',
        nodeId: getNodeId(),
        sessionData: { cwd },
      },
    });

    console.log(`[squad] Session started: ${session.id} for workflow ${ctx.workflowId} (cwd: ${cwd})`);

    return {
      sessionId: session.id,
      adapterSessionId: '', // Will be set after first executeStep
    };
  }

  async executeStep(
    handle: SessionHandle,
    step: StepInput,
    onLog: LogCallback,
  ): Promise<StepResult> {
    const prisma = getPrisma();

    // Load session from DB for context
    const session = await prisma.taskSession.findUnique({ where: { id: handle.sessionId } });
    if (!session) throw new Error(`Session ${handle.sessionId} not found`);

    const isResume = !!handle.adapterSessionId;
    const adapterSessionId = handle.adapterSessionId || randomUUID();

    // Build Claude CLI args
    const args = buildArgs(step.prompt, adapterSessionId, isResume, session.workflowId);

    // Add output schema instruction if provided
    const prompt = step.outputSchema
      ? `${step.prompt}\n\nReturn your output as JSON matching this schema:\n${JSON.stringify(step.outputSchema, null, 2)}`
      : step.prompt;

    // Override prompt in args
    args[1] = prompt;

    const cwd = (session.sessionData as Record<string, string>)?.cwd || env.WORKSPACE_PATH;

    // Spawn Claude CLI
    const proc = spawnClaude(args, cwd, session.accountId);
    const parser = new TranscriptParser();

    activeProcesses.set(handle.sessionId, { process: proc, adapterSessionId, parser });

    // Update session in DB
    await prisma.taskSession.update({
      where: { id: handle.sessionId },
      data: {
        adapterSessionId,
        status: 'active',
        pid: proc.pid,
        heartbeatAt: new Date(),
      },
    });

    // Execute and collect result
    return new Promise<StepResult>((resolve) => {
      let stderr = '';
      let capturedSessionId = adapterSessionId;
      let totalUsage: UsageInfo = {
        inputTokens: 0,
        outputTokens: 0,
        modelId: 'unknown',
        costUsd: 0,
        durationMs: 0,
      };
      const startTime = Date.now();
      let lastMessage = '';

      // Timeout
      const timeout = setTimeout(() => {
        console.warn(`[squad] Timeout for session ${handle.sessionId}`);
        proc.kill('SIGTERM');
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
      }, env.SESSION_TIMEOUT_MS);

      // stdout → transcript parser → onLog
      proc.stdout?.on('data', (chunk: Buffer) => {
        const entries = parser.feed(chunk);
        for (const { entry, capturedSessionId: sid } of entries) {
          // Capture session ID from init event
          if (sid) {
            capturedSessionId = sid;
            handle.adapterSessionId = sid;
          }

          // Capture usage from cost event
          if (entry.kind === 'cost') {
            totalUsage.inputTokens = entry.inputTokens;
            totalUsage.outputTokens = entry.outputTokens;
            totalUsage.costUsd = entry.costUsd;
          }

          // Capture last message for output extraction
          if (entry.kind === 'message') {
            lastMessage = entry.text;
          }

          // Capture model from init
          if (entry.kind === 'init' && entry.model) {
            totalUsage.modelId = entry.model;
          }

          // Stream to UI
          onLog(entry);
        }
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 10240) stderr = stderr.slice(-10240);
      });

      proc.on('close', async (exitCode) => {
        clearTimeout(timeout);
        activeProcesses.delete(handle.sessionId);

        // Flush remaining buffer
        const remaining = parser.flush();
        for (const { entry } of remaining) {
          onLog(entry);
        }

        totalUsage.durationMs = Date.now() - startTime;

        // Update session in DB
        await prisma.taskSession.update({
          where: { id: handle.sessionId },
          data: {
            adapterSessionId: capturedSessionId,
            status: 'paused',
            pid: null,
            heartbeatAt: new Date(),
          },
        }).catch(() => {});

        if (exitCode === 0) {
          // Try to parse structured output from last message
          const output = tryParseJson(lastMessage) ?? { result: lastMessage };

          resolve({
            success: true,
            output,
            usage: totalUsage,
            error: null,
          });
        } else {
          resolve({
            success: false,
            output: {},
            usage: totalUsage,
            error: stderr ? stderr.slice(0, 2000) : `Exit code: ${exitCode}`,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        activeProcesses.delete(handle.sessionId);

        resolve({
          success: false,
          output: {},
          usage: null,
          error: err.message,
        });
      });
    });
  }

  async pauseSession(handle: SessionHandle): Promise<void> {
    const entry = activeProcesses.get(handle.sessionId);
    if (entry?.process) {
      entry.process.kill('SIGTERM');
      const killTimer = setTimeout(() => {
        try { entry.process.kill('SIGKILL'); } catch {}
      }, 5000);
      entry.process.once('close', () => clearTimeout(killTimer));
    }

    const prisma = getPrisma();
    await prisma.taskSession.update({
      where: { id: handle.sessionId },
      data: { status: 'paused', pid: null },
    }).catch(() => {});

    activeProcesses.delete(handle.sessionId);
    console.log(`[squad] Session paused: ${handle.sessionId}`);
  }

  async resumeSession(handle: SessionHandle, ctx: SessionStartContext): Promise<SessionHandle> {
    if (!handle.adapterSessionId) {
      throw new Error('Cannot resume session without adapterSessionId');
    }

    const prisma = getPrisma();
    await prisma.taskSession.update({
      where: { id: handle.sessionId },
      data: { status: 'active', nodeId: getNodeId(), heartbeatAt: new Date() },
    });

    console.log(`[squad] Session resumed: ${handle.sessionId} (adapter: ${handle.adapterSessionId})`);

    // Handle keeps same sessionId and adapterSessionId
    // Next executeStep will use --resume with the adapterSessionId
    return handle;
  }

  async endSession(handle: SessionHandle): Promise<void> {
    // Kill process if still alive
    const entry = activeProcesses.get(handle.sessionId);
    if (entry?.process) {
      entry.process.kill('SIGTERM');
      setTimeout(() => { try { entry.process.kill('SIGKILL'); } catch {} }, 5000);
    }
    activeProcesses.delete(handle.sessionId);

    // Mark session completed in DB
    const prisma = getPrisma();
    await prisma.taskSession.update({
      where: { id: handle.sessionId },
      data: { status: 'completed', pid: null },
    }).catch(() => {});

    // Clean up hooks file
    const session = await prisma.taskSession.findUnique({ where: { id: handle.sessionId } });
    if (session) {
      removeHooksSettingsFile(session.workflowId);
    }

    console.log(`[squad] Session ended: ${handle.sessionId}`);
  }

  // ─── ExecutionAdapter (stateless fallback) ──────────────────────

  async execute(ctx: AdapterContext): Promise<StepResult> {
    // Stateless execution: start → execute one step → end
    const handle = await this.startSession({
      workflowId: ctx.workflowId,
      taskId: ctx.stepId,
      accountId: ctx.accountId,
      adapterConfig: ctx.adapterConfig,
      cwd: env.WORKSPACE_PATH,
    });

    try {
      const result = await this.executeStep(
        handle,
        { stepId: ctx.stepId, definitionStepId: ctx.stepId, prompt: ctx.prompt, input: ctx.input, outputSchema: ctx.outputSchema },
        ctx.onLog,
      );
      return result;
    } finally {
      await this.endSession(handle);
    }
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    // Could check: claude binary exists, workspace path exists, etc.
    return { valid: errors.length === 0, errors };
  }
}

// ─── Internal helpers ───────────────────────────────────────────────

function buildArgs(prompt: string, sessionId: string, isResume: boolean, workflowId: string): string[] {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'auto',
    '--allowedTools', getAllowedTools(),
  ];

  // Add hooks settings
  const settingsFile = createHooksSettingsFile(workflowId);
  args.push('--settings', settingsFile);

  if (isResume) {
    args.push('--resume', sessionId);
  } else {
    args.push('--session-id', sessionId);
  }

  return args;
}

function getAllowedTools(): string {
  // No longer includes MCP approval tools (MCP removed per D2)
  return 'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Agent';
}

function spawnClaude(args: string[], cwd: string, accountId: string): ChildProcess {
  const claudeBin = process.env.CLAUDE_BIN || '/usr/local/bin/claude';
  return spawn(claudeBin, args, {
    cwd,
    env: {
      ...process.env,
      HOME: process.env.HOME || '/home/vialum',
      PATH: `/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
      VIALUM_ACCOUNT_ID: accountId,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getNodeId(): string {
  return process.env.HOSTNAME || process.env.NODE_ID || 'local';
}

/**
 * Resolve workspace for a squad session.
 *
 * If adapterConfig.squadRef is set:
 *   1. Creates case directory: /workspaces/tenants/{accountId}/cases/{workflowId}/
 *   2. Symlinks squad files (CLAUDE.md, agents/, tasks/, scripts/, resources/, .synapse/)
 *   3. Returns case directory as cwd
 *
 * If no squadRef: returns default WORKSPACE_PATH.
 */
function resolveWorkspace(ctx: SessionStartContext): string {
  const config = ctx.adapterConfig ?? {};
  const squadRef = config.squadRef as string | undefined;

  if (!squadRef) {
    return ctx.cwd || env.WORKSPACE_PATH;
  }

  const sharedSquadsBase = process.env.SHARED_SQUADS_PATH || '/workspaces/shared/squads';
  const tenantsBase = process.env.TENANTS_WORKSPACE_PATH || '/workspaces/tenants';

  const squadPath = join(sharedSquadsBase, squadRef);
  const casePath = join(tenantsBase, ctx.accountId, 'cases', ctx.workflowId);

  // Create case directory
  mkdirSync(casePath, { recursive: true });

  // Symlink squad contents into case directory
  const dirsToLink = ['agents', 'tasks', 'scripts', 'resources', '.synapse', 'workflows'];
  const filesToLink = ['CLAUDE.md', 'squad.yaml'];

  for (const dir of dirsToLink) {
    const src = join(squadPath, dir);
    const dest = join(casePath, dir);
    if (existsSync(src) && !existsSync(dest)) {
      try { symlinkSync(src, dest); } catch {}
    }
  }

  for (const file of filesToLink) {
    const src = join(squadPath, file);
    const dest = join(casePath, file);
    if (existsSync(src) && !existsSync(dest)) {
      try { symlinkSync(src, dest); } catch {}
    }
  }

  console.log(`[squad] Workspace resolved: squadRef=${squadRef} → ${casePath}`);
  return casePath;
}

function tryParseJson(text: string): Record<string, unknown> | null {
  // Try to extract JSON from Claude's response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || text.match(/^\s*(\{[\s\S]*\})\s*$/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ─── Shutdown helper ────────────────────────────────────────────────

export async function stopAllSquadSessions(): Promise<void> {
  for (const [sessionId, entry] of activeProcesses) {
    try {
      entry.process.kill('SIGTERM');
    } catch {}
  }

  const deadline = Date.now() + 10000;
  while (activeProcesses.size > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }

  // Force kill remaining
  for (const [, entry] of activeProcesses) {
    try { entry.process.kill('SIGKILL'); } catch {}
  }
  activeProcesses.clear();
}
