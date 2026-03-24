import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';
import { getPrisma } from '../config/database.js';
import { env } from '../config/env.js';
import { sessionStore, SessionInfo } from './session-store.js';
import { OutputProcessor } from './output-processor.js';
import { broadcastToAccount, broadcastToWorkflow } from '../plugins/websocket.js';
import { createHooksSettingsFile, removeHooksSettingsFile } from './hooks-config.js';

const outputProcessor = new OutputProcessor();

// Per-tenant session limit (default: global max / can be overridden per account in the future)
const MAX_SESSIONS_PER_TENANT = env.MAX_CONCURRENT_SESSIONS;

interface StartOptions {
  workflowId: string;
  accountId: string;
  prompt: string;
  cwd?: string;
  sessionId?: string; // existing session to resume
}

/**
 * Start a new Claude CLI session for a workflow.
 */
export async function startSession(opts: StartOptions): Promise<string> {
  const { workflowId, accountId, prompt, cwd } = opts;

  // Mutex: prevent double-spawn for same workflow
  if (!sessionStore.acquireLock(workflowId)) {
    throw new Error('Session is already being started for this workflow');
  }

  try {
    // Check if already active
    if (sessionStore.has(workflowId)) {
      throw new Error('Session already active for this workflow');
    }

    // Check global limit
    if (sessionStore.activeCount >= env.MAX_CONCURRENT_SESSIONS) {
      throw new Error(`Max concurrent sessions reached (${env.MAX_CONCURRENT_SESSIONS})`);
    }

    // Check per-tenant limit
    if (sessionStore.activeCountForTenant(accountId) >= MAX_SESSIONS_PER_TENANT) {
      throw new Error(`Max sessions per tenant reached (${MAX_SESSIONS_PER_TENANT})`);
    }

    const sessionId = opts.sessionId ?? randomUUID();
    const args = buildArgs(prompt, sessionId, !!opts.sessionId, workflowId);

    const proc = spawnClaude(args, cwd || env.WORKSPACE_PATH, accountId);

    const info: SessionInfo = {
      workflowId,
      accountId,
      process: proc,
      sessionId,
      status: 'running',
      startedAt: new Date(),
      commandQueue: [],
    };

    sessionStore.set(workflowId, info);
    wireProcess(info);

    // Update DB
    const prisma = getPrisma();
    await prisma.workflow.update({
      where: { id: workflowId },
      data: { sessionId, status: 'running', startedAt: new Date() },
    });

    broadcastToAccount(accountId, 'workflow:updated', {
      workflowId,
      status: 'running',
      sessionId,
    });

    return sessionId;
  } finally {
    sessionStore.releaseLock(workflowId);
  }
}

/**
 * Send a command to an existing workflow.
 * If Claude is currently running, queues it. If idle (session ended), resumes.
 */
export async function sendCommand(workflowId: string, command: string): Promise<{ queued: boolean }> {
  const info = sessionStore.get(workflowId);

  // Case 1: Process is running — queue the command
  if (info && info.process && info.status === 'running') {
    info.commandQueue.push(command);
    broadcastToWorkflow(workflowId, 'command:queued', {
      command,
      position: info.commandQueue.length,
    });
    return { queued: true };
  }

  // Case 2: No active process — resume session
  const prisma = getPrisma();
  const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
  if (!workflow) throw new Error('Workflow not found');
  if (!workflow.sessionId) throw new Error('No session to resume');

  await startSession({
    workflowId,
    accountId: workflow.accountId,
    prompt: command,
    sessionId: workflow.sessionId,
    cwd: undefined, // will use default
  });

  return { queued: false };
}

/**
 * Stop a running session.
 */
export async function stopSession(workflowId: string): Promise<void> {
  const info = sessionStore.get(workflowId);
  if (!info?.process) return;

  info.status = 'stopping';
  info.commandQueue = []; // discard queued commands

  // Graceful: SIGTERM, then SIGKILL after 5s
  info.process.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    try { info.process?.kill('SIGKILL'); } catch { /* already dead */ }
  }, 5000);

  info.process.once('close', () => clearTimeout(killTimer));
}

/**
 * Stop all active sessions (for graceful shutdown).
 */
export async function stopAllSessions(): Promise<void> {
  const all = sessionStore.allActive();
  await Promise.allSettled(all.map((info) => stopSession(info.workflowId)));

  // Wait up to 10s for all to close
  const deadline = Date.now() + 10000;
  while (sessionStore.activeCount > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
  }
}

// --- Internal ---

function buildArgs(prompt: string, sessionId: string, isResume: boolean, workflowId: string): string[] {
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--dangerously-skip-permissions',
    '--mcp-config', getMcpConfigPath(),
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

function getMcpConfigPath(): string {
  // In Docker: /app/mcp-config.json. In dev: relative to project root.
  const path = process.env.MCP_CONFIG_PATH || '/app/mcp-config.json';
  return path;
}

function spawnClaude(args: string[], cwd: string, accountId: string): ChildProcess {
  return spawn('claude', args, {
    cwd,
    env: {
      ...process.env,
      // Passed to MCP server via env interpolation in mcp-config.json
      VIALUM_ACCOUNT_ID: accountId,
      JWT_SECRET: env.JWT_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function wireProcess(info: SessionInfo): void {
  const { workflowId, accountId, process: proc } = info;
  if (!proc) return;

  let stderr = '';

  // Timeout
  const timeout = setTimeout(() => {
    console.warn(`[session] Timeout for workflow ${workflowId} after ${env.SESSION_TIMEOUT_MS}ms`);
    info.commandQueue = [];
    proc.kill('SIGTERM');
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
    }, 5000);
  }, env.SESSION_TIMEOUT_MS);

  // stdout → output processor
  proc.stdout?.on('data', async (chunk: Buffer) => {
    const capturedSessionId = await outputProcessor.processChunk(workflowId, accountId, chunk);
    // Update sessionId if captured from stream (when Claude assigns one)
    if (capturedSessionId && info.sessionId !== capturedSessionId) {
      info.sessionId = capturedSessionId;
      const prisma = getPrisma();
      await prisma.workflow.update({
        where: { id: workflowId },
        data: { sessionId: capturedSessionId },
      }).catch(() => {});
    }
  });

  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
    // Cap stderr buffer at 10KB
    if (stderr.length > 10240) stderr = stderr.slice(-10240);
  });

  proc.on('close', async (exitCode) => {
    clearTimeout(timeout);
    outputProcessor.flush(workflowId);
    info.process = null;

    await handleSessionEnd(info, exitCode, stderr);
  });

  proc.on('error', async (err) => {
    clearTimeout(timeout);
    outputProcessor.flush(workflowId);
    info.process = null;
    console.error(`[session] Process error for ${workflowId}:`, err.message);

    await handleSessionEnd(info, null, err.message);
  });
}

async function handleSessionEnd(info: SessionInfo, exitCode: number | null, stderr: string): Promise<void> {
  const { workflowId, accountId, commandQueue } = info;
  const prisma = getPrisma();

  // If there are queued commands, resume with the next one
  if (commandQueue.length > 0 && exitCode === 0) {
    const nextCommand = commandQueue.shift()!;
    console.log(`[session] Processing queued command for ${workflowId}: "${nextCommand.slice(0, 80)}"`);

    try {
      const args = buildArgs(nextCommand, info.sessionId!, true, workflowId);
      const proc = spawnClaude(args, env.WORKSPACE_PATH, accountId);
      info.process = proc;
      info.status = 'running';
      info.startedAt = new Date();
      wireProcess(info);
      return; // Don't clean up — session continues
    } catch (err) {
      console.error(`[session] Failed to resume with queued command:`, err);
      // Fall through to cleanup
    }
  }

  // Determine final workflow status
  let newStatus: string;
  let errorMessage: string | null = null;

  if (info.status === 'stopping') {
    newStatus = 'cancelled';
  } else if (exitCode === 0) {
    newStatus = 'paused'; // Claude finished naturally — paused until next command or event
  } else {
    newStatus = 'failed';
    errorMessage = stderr ? stderr.slice(0, 2000) : `Exit code: ${exitCode}`;
  }

  // Update DB
  try {
    const data: Record<string, unknown> = { status: newStatus };
    if (errorMessage) data.errorMessage = errorMessage;
    if (newStatus === 'completed' || newStatus === 'cancelled') {
      data.completedAt = new Date();
    }
    await prisma.workflow.update({ where: { id: workflowId }, data });
  } catch (err) {
    console.error(`[session] Failed to update workflow ${workflowId}:`, err);
  }

  // Persist end event
  try {
    await prisma.workflowEvent.create({
      data: {
        accountId,
        workflowId,
        eventType: 'session.end',
        payload: { exitCode, status: newStatus, errorMessage },
      },
    });
  } catch { /* best effort */ }

  // Broadcast
  broadcastToWorkflow(workflowId, 'workflow:updated', {
    workflowId,
    status: newStatus,
    exitCode,
  });
  broadcastToAccount(accountId, 'workflow:updated', {
    workflowId,
    status: newStatus,
  });

  // Cleanup
  removeHooksSettingsFile(workflowId);
  sessionStore.delete(workflowId);
  console.log(`[session] Session ended for ${workflowId}: status=${newStatus} exit=${exitCode}`);
}
