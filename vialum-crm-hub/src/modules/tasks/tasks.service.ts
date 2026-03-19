// ════════════════════════════════════════════════════════════
// Tasks Service — Resolves tenant's task provider and delegates
// ════════════════════════════════════════════════════════════

import { getPrisma } from '../../config/database.js';
import { getTaskProvider } from '../../providers/task-provider.registry.js';
import type {
  TaskProviderConfig,
  TaskResource,
  TaskMember,
  CreateTaskParams,
  UpdateTaskParams,
} from '../../providers/task-provider.interface.js';

async function resolveProvider(accountId: string) {
  const prisma = getPrisma();

  const providerConfig = await prisma.providerConfig.findFirst({
    where: { accountId, category: 'tasks', active: true },
  });

  if (!providerConfig) {
    throw { statusCode: 404, message: 'No task provider configured for this account', code: 'NO_TASK_PROVIDER' };
  }

  const provider = getTaskProvider(providerConfig.provider);
  if (!provider) {
    throw { statusCode: 500, message: `Task provider "${providerConfig.provider}" not registered`, code: 'PROVIDER_NOT_FOUND' };
  }

  const config = providerConfig.config as unknown as TaskProviderConfig;
  return { provider, config, providerName: providerConfig.provider };
}

async function audit(accountId: string, providerName: string, operation: string, entityId: string | null, params: unknown, result: unknown, status: string, error: string | null, caller: string | null, durationMs: number) {
  const prisma = getPrisma();
  await prisma.providerOperation.create({
    data: {
      accountId,
      provider: providerName,
      category: 'tasks',
      operation,
      entityId,
      params: params as object,
      result: result as object,
      status,
      error,
      caller,
      durationMs,
    },
  });
}

async function withAudit<T>(
  accountId: string,
  providerName: string,
  operation: string,
  entityId: string | null,
  params: unknown,
  caller: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await audit(accountId, providerName, operation, entityId, params, result, 'success', null, caller, Date.now() - start);
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await audit(accountId, providerName, operation, entityId, params, null, 'failed', message, caller, Date.now() - start).catch(() => {});
    throw err;
  }
}

// ── Public API ──────────────────────────────────────────

export async function getTask(accountId: string, taskId: string): Promise<TaskResource | null> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'get_task', taskId, {}, null,
    () => provider.getTask(config, taskId));
}

export async function searchTasks(accountId: string, query: string, listId?: string): Promise<TaskResource[]> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'search_tasks', null, { query, listId }, null,
    () => provider.searchTasks(config, query, listId));
}

export async function getMembers(accountId: string): Promise<TaskMember[]> {
  const { provider, config } = await resolveProvider(accountId);
  return provider.getMembers(config);
}

export async function createTask(accountId: string, params: CreateTaskParams, caller?: string): Promise<TaskResource> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'create_task', null, params, caller ?? null,
    () => provider.createTask(config, params));
}

export async function updateTask(accountId: string, taskId: string, params: UpdateTaskParams, caller?: string): Promise<TaskResource> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'update_task', taskId, params, caller ?? null,
    () => provider.updateTask(config, taskId, params));
}

export async function updateStatus(accountId: string, taskId: string, status: string, caller?: string): Promise<TaskResource> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'update_status', taskId, { status }, caller ?? null,
    () => provider.updateStatus(config, taskId, status));
}

export async function addComment(accountId: string, taskId: string, text: string, caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'add_comment', taskId, { text }, caller ?? null,
    () => provider.addComment(config, taskId, text));
}

export async function addAttachment(accountId: string, taskId: string, fileUrl: string, filename: string, caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'add_attachment', taskId, { fileUrl, filename }, caller ?? null,
    () => provider.addAttachment(config, taskId, fileUrl, filename));
}

export async function setField(accountId: string, taskId: string, fieldKey: string, value: unknown, caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'set_field', taskId, { fieldKey, value }, caller ?? null,
    () => provider.setField(config, taskId, fieldKey, value));
}

export async function setAssignees(accountId: string, taskId: string, assignees: string[], caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'set_assignees', taskId, { assignees }, caller ?? null,
    () => provider.setAssignees(config, taskId, assignees));
}

export async function addTag(accountId: string, taskId: string, tag: string, caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'add_tag', taskId, { tag }, caller ?? null,
    () => provider.addTag(config, taskId, tag));
}

export async function removeTag(accountId: string, taskId: string, tag: string, caller?: string): Promise<void> {
  const { provider, config, providerName } = await resolveProvider(accountId);
  return withAudit(accountId, providerName, 'remove_tag', taskId, { tag }, caller ?? null,
    () => provider.removeTag(config, taskId, tag));
}
