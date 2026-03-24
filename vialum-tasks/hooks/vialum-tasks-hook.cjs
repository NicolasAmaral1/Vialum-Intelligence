#!/usr/bin/env node
/**
 * Claude Code hook script for Vialum Tasks.
 *
 * Receives JSON on stdin from Claude hooks (PostToolUse, Stop, etc.)
 * and POSTs it to the Tasks backend as a fire-and-forget event.
 *
 * RULES:
 * - Always exit 0 (never block Claude)
 * - Never write to stdout (reserved for hook JSON response)
 * - Use stderr for logging
 * - Timeout: 3 seconds max
 */

const http = require('http');
const https = require('https');

const TASKS_URL = process.env.TASKS_HOOK_URL || 'http://localhost:3005/tasks/api/v1/events/hook';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const TIMEOUT_MS = 3000;

async function main() {
  // Read JSON from stdin
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0); // malformed input — don't block
  }

  // Build payload
  const payload = JSON.stringify({
    session_id: data.session_id || null,
    event_type: data.hook_event_name || 'unknown',
    tool_name: data.tool_name || null,
    payload: {
      tool_input: data.tool_input || null,
      tool_result: data.tool_result || null,
      cwd: data.cwd || null,
    },
  });

  // Parse URL
  const url = new URL(TASKS_URL);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  // Fire-and-forget POST
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(); // timeout — don't block
    }, TIMEOUT_MS);

    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Webhook-Secret': WEBHOOK_SECRET,
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // Drain response
        res.resume();
        clearTimeout(timer);
        resolve();
      }
    );

    req.on('error', () => {
      clearTimeout(timer);
      resolve(); // swallow errors
    });

    req.on('timeout', () => {
      req.destroy();
      clearTimeout(timer);
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

main()
  .catch(() => {})
  .finally(() => process.exit(0)); // ALWAYS exit 0
