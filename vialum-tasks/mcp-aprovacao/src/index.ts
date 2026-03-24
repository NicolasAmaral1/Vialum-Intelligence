import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import jwt from 'jsonwebtoken';

// Config from environment (passed by Session Manager via spawn env)
const TASKS_API_URL = process.env.TASKS_API_URL || 'http://localhost:3005';
const JWT_SECRET = process.env.JWT_SECRET || '';
const ACCOUNT_ID = process.env.VIALUM_ACCOUNT_ID || '';
const POLL_INTERVAL_MS = parseInt(process.env.APPROVAL_POLL_INTERVAL_MS || '5000', 10);
const MAX_POLL_DURATION_MS = parseInt(process.env.APPROVAL_MAX_WAIT_MS || '7200000', 10); // 2 hours

function log(msg: string) {
  // stderr only — stdout is reserved for JSON-RPC
  process.stderr.write(`[mcp-aprovacao] ${msg}\n`);
}

function generateServiceToken(): string {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not set');
  if (!ACCOUNT_ID) throw new Error('VIALUM_ACCOUNT_ID not set');
  return jwt.sign(
    { userId: 'mcp-aprovacao', accountId: ACCOUNT_ID, role: 'service' },
    JWT_SECRET,
    { expiresIn: '1h' },
  );
}

async function apiCall(method: string, path: string, body?: unknown): Promise<Response> {
  const token = generateServiceToken();
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${TASKS_API_URL}${path}`, opts);
}

// ---- MCP Server ----

const server = new Server(
  { name: 'aprovacao', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'request_approval',
      description:
        'Request human approval for a workflow step. This tool BLOCKS until a human approves or rejects via the dashboard. Use it when you need human verification before proceeding (e.g., reviewing generated documents, confirming data accuracy, authorizing an action).',
      inputSchema: {
        type: 'object' as const,
        properties: {
          workflow_id: {
            type: 'string',
            description: 'The workflow ID this approval belongs to',
          },
          step: {
            type: 'string',
            description: 'Step identifier (e.g., "review_contract", "verify_signature")',
          },
          title: {
            type: 'string',
            description: 'Human-readable title shown in the approval queue',
          },
          description: {
            type: 'string',
            description: 'Detailed description of what needs to be reviewed/approved',
          },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                type: { type: 'string' },
              },
            },
            description: 'Files or data to present to the reviewer',
          },
          form_schema: {
            type: 'object',
            description: 'Optional JSON Schema for a form the reviewer should fill out',
          },
        },
        required: ['workflow_id', 'step', 'title'],
      },
    },
    {
      name: 'check_approval_status',
      description:
        'Check the current status of a previously created approval without blocking. Returns immediately.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          approval_id: {
            type: 'string',
            description: 'The approval ID to check',
          },
        },
        required: ['approval_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'request_approval') {
    return await handleRequestApproval(args as Record<string, unknown>);
  }

  if (name === 'check_approval_status') {
    return await handleCheckStatus(args as Record<string, unknown>);
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function handleRequestApproval(args: Record<string, unknown>) {
  const { workflow_id, step, title, description, attachments, form_schema } = args;

  // 1. Create approval record
  let approvalId: string;
  try {
    const res = await apiCall('POST', '/tasks/api/v1/approvals', {
      workflow_id,
      step,
      title,
      description: description || null,
      attachments: attachments || [],
      form_schema: form_schema || null,
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        content: [{ type: 'text', text: `Failed to create approval: ${res.status} ${err}` }],
        isError: true,
      };
    }

    const data = (await res.json()) as { data: { id: string; status: string } };
    approvalId = data.data.id;

    // If returned existing (idempotency), check if already decided
    if (data.data.status !== 'pending') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: data.data.status,
            message: 'Approval was already decided',
          }),
        }],
      };
    }

    log(`Created approval ${approvalId} for workflow ${workflow_id}, step "${step}"`);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error creating approval: ${err}` }],
      isError: true,
    };
  }

  // 2. Poll until decided
  const startTime = Date.now();
  let lastLogTime = 0;

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const res = await apiCall('GET', `/tasks/api/v1/approvals/${approvalId}`);
      if (!res.ok) {
        log(`Poll error: ${res.status}`);
        continue; // transient error, keep polling
      }

      const data = (await res.json()) as {
        data: {
          status: string;
          decidedBy: string | null;
          reason: string | null;
          formData: unknown;
        };
      };

      const { status, decidedBy, reason, formData } = data.data;

      if (status === 'approved') {
        log(`Approval ${approvalId} APPROVED by ${decidedBy}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'approved',
              decided_by: decidedBy,
              reason,
              form_data: formData,
            }),
          }],
        };
      }

      if (status === 'rejected') {
        log(`Approval ${approvalId} REJECTED by ${decidedBy}: ${reason}`);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'rejected',
              decided_by: decidedBy,
              reason,
              form_data: formData,
            }),
          }],
        };
      }

      // Still pending — log occasionally
      const now = Date.now();
      if (now - lastLogTime > 60000) {
        const elapsed = Math.round((now - startTime) / 1000);
        log(`Waiting for approval ${approvalId}... (${elapsed}s elapsed)`);
        lastLogTime = now;
      }
    } catch (err) {
      log(`Poll network error: ${err}`);
      // Continue polling on transient errors
    }
  }

  // Timeout
  log(`Approval ${approvalId} TIMED OUT after ${MAX_POLL_DURATION_MS / 1000}s`);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        status: 'timeout',
        message: `Approval timed out after ${Math.round(MAX_POLL_DURATION_MS / 60000)} minutes. The request is still pending in the dashboard.`,
        approval_id: approvalId,
      }),
    }],
    isError: true,
  };
}

async function handleCheckStatus(args: Record<string, unknown>) {
  const { approval_id } = args;
  try {
    const res = await apiCall('GET', `/tasks/api/v1/approvals/${approval_id}`);
    if (!res.ok) {
      return {
        content: [{ type: 'text', text: `Approval not found: ${res.status}` }],
        isError: true,
      };
    }
    const data = (await res.json()) as { data: Record<string, unknown> };
    return {
      content: [{ type: 'text', text: JSON.stringify(data.data) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error checking status: ${err}` }],
      isError: true,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Start ----

async function main() {
  if (!ACCOUNT_ID) {
    log('WARNING: VIALUM_ACCOUNT_ID not set — approval creation will fail');
  }
  if (!JWT_SECRET) {
    log('WARNING: JWT_SECRET not set — API calls will fail');
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP server started on stdio');
}

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`);
  process.exit(1);
});

main().catch((err) => {
  log(`Fatal: ${err}`);
  process.exit(1);
});
