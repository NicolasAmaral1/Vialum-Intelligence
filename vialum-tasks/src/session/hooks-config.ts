import { writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env.js';

const HOOKS_DIR = '/tmp/vialum-tasks-hooks';

/**
 * Generate a temporary settings JSON file with hook configuration for a Claude session.
 * Returns the file path to pass via --settings.
 */
export function createHooksSettingsFile(workflowId: string): string {
  mkdirSync(HOOKS_DIR, { recursive: true });

  const hookCommand = getHookCommand();

  const settings = {
    hooks: {
      PostToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: hookCommand,
              timeout: 5,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: 'command',
              command: hookCommand,
              timeout: 5,
            },
          ],
        },
      ],
    },
  };

  const filePath = join(HOOKS_DIR, `${workflowId}.json`);
  writeFileSync(filePath, JSON.stringify(settings), 'utf-8');
  return filePath;
}

/**
 * Clean up temporary settings file after session ends.
 */
export function removeHooksSettingsFile(workflowId: string): void {
  try {
    unlinkSync(join(HOOKS_DIR, `${workflowId}.json`));
  } catch {
    // file may not exist — ok
  }
}

function getHookCommand(): string {
  // In Docker: /app/hooks/. In dev: resolve from project root.
  const hookScript = process.env.HOOKS_SCRIPT_PATH || '/app/hooks/vialum-tasks-hook.cjs';
  const tasksUrl = process.env.TASKS_HOOK_URL || `http://localhost:${env.PORT}/tasks/api/v1/events/hook`;

  // Env vars are embedded in the command so the hook script can read them
  return `TASKS_HOOK_URL="${tasksUrl}" WEBHOOK_SECRET="${env.WEBHOOK_SECRET}" node "${hookScript}"`;
}
