import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { env } from '../../config/env.js';
import type {
  ExecutionAdapter,
  AdapterContext,
  StepResult,
  LogCallback,
  TranscriptEntry,
} from '../adapter.interface.js';

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

const RUNTIME_MAP: Record<string, string> = {
  '.py': 'python3',
  '.js': 'node',
  '.sh': 'bash',
  '.ts': 'npx tsx',
};

/**
 * Script Adapter — runs Python/Node/Shell scripts as system steps.
 *
 * Input: JSON via stdin (from ContextBus)
 * Output: JSON via stdout (validated against outputSchema)
 * Errors: stderr captured as error message
 *
 * adapterConfig:
 *   script: "squads/protocolo/scripts/gerar_contrato.py"  (required)
 *   runtime: "python3"  (optional, auto-detected from extension)
 *   timeout: 120000     (optional, ms)
 *   env: { KEY: "value" }  (optional, extra env vars)
 */
export class ScriptAdapter implements ExecutionAdapter {
  readonly type = 'script';
  readonly displayName = 'Script Runner';

  async execute(ctx: AdapterContext): Promise<StepResult> {
    const config = ctx.adapterConfig ?? {};
    const scriptPath = config.script as string;

    if (!scriptPath) {
      return {
        success: false,
        output: {},
        usage: null,
        error: 'adapterConfig.script is required for script adapter',
      };
    }

    // Resolve script path (relative to shared squads or absolute)
    const sharedBase = process.env.SHARED_SQUADS_PATH || '/workspaces/shared/squads';
    const fullPath = scriptPath.startsWith('/')
      ? scriptPath
      : join(sharedBase, '..', scriptPath);

    if (!existsSync(fullPath)) {
      return {
        success: false,
        output: {},
        usage: null,
        error: `Script not found: ${fullPath}`,
      };
    }

    // Determine runtime
    const ext = extname(fullPath);
    const runtime = (config.runtime as string) || RUNTIME_MAP[ext];
    if (!runtime) {
      return {
        success: false,
        output: {},
        usage: null,
        error: `Unknown script type: ${ext}. Set adapterConfig.runtime explicitly.`,
      };
    }

    const timeoutMs = (config.timeout as number) || DEFAULT_TIMEOUT_MS;
    const extraEnv = (config.env as Record<string, string>) || {};

    // Log start
    ctx.onLog({ kind: 'status', text: `Running script: ${scriptPath}`, ts: new Date().toISOString() });

    const startTime = Date.now();

    return new Promise<StepResult>((resolve) => {
      const args = runtime.includes(' ')
        ? [...runtime.split(' '), fullPath]
        : [fullPath];

      const command = runtime.includes(' ') ? runtime.split(' ')[0] : runtime;
      const spawnArgs = runtime.includes(' ')
        ? [...runtime.split(' ').slice(1), fullPath]
        : [fullPath];

      const proc = spawn(command, spawnArgs, {
        env: {
          ...process.env,
          ...extraEnv,
          VIALUM_ACCOUNT_ID: ctx.accountId,
          VIALUM_WORKFLOW_ID: ctx.workflowId,
          VIALUM_STEP_ID: ctx.stepId,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      // Timeout
      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
        setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 5000);
      }, timeoutMs);

      // Send input via stdin
      const inputJson = JSON.stringify(ctx.input ?? {});
      proc.stdin?.write(inputJson);
      proc.stdin?.end();

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        // Stream stderr as log entries
        ctx.onLog({ kind: 'status', text: text.trim(), ts: new Date().toISOString() });
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        ctx.onLog({
          kind: 'status',
          text: `Script finished (exit: ${exitCode}, ${durationMs}ms)`,
          ts: new Date().toISOString(),
        });

        if (exitCode === 0) {
          // Try to parse JSON output
          let output: Record<string, unknown>;
          try {
            output = JSON.parse(stdout.trim());
          } catch {
            // If not JSON, wrap as result
            output = { result: stdout.trim() };
          }

          resolve({
            success: true,
            output,
            usage: { inputTokens: 0, outputTokens: 0, modelId: 'script', costUsd: 0, durationMs },
            error: null,
          });
        } else {
          resolve({
            success: false,
            output: {},
            usage: { inputTokens: 0, outputTokens: 0, modelId: 'script', costUsd: 0, durationMs },
            error: stderr ? stderr.slice(0, 2000) : `Script exit code: ${exitCode}`,
          });
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          output: {},
          usage: null,
          error: `Failed to spawn script: ${err.message}`,
        });
      });
    });
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!config.script) errors.push('script path is required');
    return { valid: errors.length === 0, errors };
  }
}
