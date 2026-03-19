// ════════════════════════════════════════════════════════════
// ClickUp Task Provider — Implements agnostic TaskProvider
// ════════════════════════════════════════════════════════════

import { apiGet, apiPost, apiPut } from '../../lib/http.js';
import { enforceRateLimit } from '../../lib/rate-limiter.js';
import type {
  TaskProvider,
  TaskProviderConfig,
  TaskResource,
  TaskMember,
  CreateTaskParams,
  UpdateTaskParams,
} from '../task-provider.interface.js';
import type { ClickUpTask } from './clickup.types.js';

const BASE = 'https://api.clickup.com/api/v2';
const RATE_KEY_PREFIX = 'clickup';
const MAX_PER_MINUTE = 90;

function headers(config: TaskProviderConfig): Record<string, string> {
  return { Authorization: config.apiToken };
}

function rateKey(config: TaskProviderConfig): string {
  return `${RATE_KEY_PREFIX}:${config.apiToken.slice(-8)}`;
}

function resolveCustomFieldId(config: TaskProviderConfig, key: string): string {
  const map = config.defaults?.customFieldMap;
  return map?.[key] ?? key;
}

function resolveAssigneeId(config: TaskProviderConfig, email: string): number | undefined {
  const map = config.defaults?.assigneeMap;
  return map?.[email];
}

function reverseAssigneeMap(config: TaskProviderConfig): Map<number, string> {
  const map = new Map<number, string>();
  const assigneeMap = config.defaults?.assigneeMap;
  if (assigneeMap) {
    for (const [email, id] of Object.entries(assigneeMap)) {
      map.set(id, email);
    }
  }
  return map;
}

function toResource(task: ClickUpTask, config: TaskProviderConfig): TaskResource {
  const reverseMap = reverseAssigneeMap(config);
  const reverseFieldMap = new Map<string, string>();
  const fieldMap = config.defaults?.customFieldMap;
  if (fieldMap) {
    for (const [key, id] of Object.entries(fieldMap)) {
      reverseFieldMap.set(id, key);
    }
  }

  const customFields: Record<string, unknown> = {};
  if (task.custom_fields) {
    for (const f of task.custom_fields) {
      const key = reverseFieldMap.get(f.id) ?? f.name ?? f.id;
      customFields[key] = f.value;
    }
  }

  const assignees: string[] = [];
  if (task.assignees) {
    for (const a of task.assignees) {
      assignees.push(reverseMap.get(a.id) ?? a.email ?? a.username ?? String(a.id));
    }
  }

  const tags: string[] = [];
  if (task.tags) {
    for (const t of task.tags) {
      tags.push(t.name);
    }
  }

  return {
    id: task.id,
    provider: 'clickup',
    name: task.name,
    description: task.description,
    status: task.status?.status ?? '',
    assignees,
    tags,
    customFields,
    externalUrl: task.url ?? `https://app.clickup.com/t/${task.id}`,
    createdAt: task.date_created ?? '',
    updatedAt: task.date_updated ?? '',
  };
}

export class ClickUpTaskProvider implements TaskProvider {
  readonly name = 'clickup';

  // ── Read ──────────────────────────────────────────────

  async getTask(config: TaskProviderConfig, taskId: string): Promise<TaskResource | null> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);
    try {
      const task = await apiGet<ClickUpTask>(
        `${BASE}/task/${taskId}?include_subtasks=true`,
        headers(config),
      );
      return toResource(task, config);
    } catch {
      return null;
    }
  }

  async searchTasks(config: TaskProviderConfig, query: string, listId?: string): Promise<TaskResource[]> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const teamsResult = await apiGet<{ teams: Array<{ id: string }> }>(
      `${BASE}/team`,
      headers(config),
    );
    const teamId = teamsResult.teams?.[0]?.id;
    if (!teamId) return [];

    const params = new URLSearchParams({ query, include_closed: 'true', subtasks: 'true' });
    if (listId) params.set('list_ids[]', listId);

    try {
      const result = await apiGet<{ tasks: ClickUpTask[] }>(
        `${BASE}/team/${teamId}/task?${params.toString()}`,
        headers(config),
      );
      return (result.tasks ?? []).slice(0, 20).map((t) => toResource(t, config));
    } catch {
      return [];
    }
  }

  async getMembers(config: TaskProviderConfig): Promise<TaskMember[]> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const teamsResult = await apiGet<{ teams: Array<{ id: string; members: Array<{ user: { id: number; username: string; email: string } }> }> }>(
      `${BASE}/team`,
      headers(config),
    );

    const team = teamsResult.teams?.[0];
    if (!team) return [];

    return team.members.map((m) => ({
      id: String(m.user.id),
      name: m.user.username,
      email: m.user.email,
    }));
  }

  // ── Write ─────────────────────────────────────────────

  async createTask(config: TaskProviderConfig, params: CreateTaskParams): Promise<TaskResource> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const listId = (params.providerParams?.listId as string) ?? config.defaults?.listId;
    if (!listId) {
      throw { statusCode: 400, message: 'listId is required (provide in providerParams or configure defaults)', code: 'MISSING_LIST_ID' };
    }

    const assigneeIds: number[] = [];
    if (params.assignees) {
      for (const email of params.assignees) {
        const id = resolveAssigneeId(config, email);
        if (id) assigneeIds.push(id);
      }
    }

    const customFields: Array<{ id: string; value: unknown }> = [];
    if (params.customFields) {
      for (const f of params.customFields) {
        customFields.push({ id: resolveCustomFieldId(config, f.key), value: f.value });
      }
    }

    const body: Record<string, unknown> = {
      name: params.name,
      description: params.description ?? '',
      assignees: assigneeIds,
      tags: params.tags ?? [],
      custom_fields: customFields,
    };
    if (params.status) body.status = params.status;

    const task = await apiPost<ClickUpTask>(
      `${BASE}/list/${listId}/task`,
      body,
      headers(config),
    );

    return toResource(task, config);
  }

  async updateTask(config: TaskProviderConfig, taskId: string, params: UpdateTaskParams): Promise<TaskResource> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.description !== undefined) body.description = params.description;
    if (params.status !== undefined) body.status = params.status;

    if (params.assignees) {
      const add: number[] = [];
      const rem: number[] = [];
      if (params.assignees.add) {
        for (const email of params.assignees.add) {
          const id = resolveAssigneeId(config, email);
          if (id) add.push(id);
        }
      }
      if (params.assignees.remove) {
        for (const email of params.assignees.remove) {
          const id = resolveAssigneeId(config, email);
          if (id) rem.push(id);
        }
      }
      body.assignees = { add, rem };
    }

    const task = await apiPut<ClickUpTask>(`${BASE}/task/${taskId}`, body, headers(config));
    return toResource(task, config);
  }

  async updateStatus(config: TaskProviderConfig, taskId: string, status: string): Promise<TaskResource> {
    return this.updateTask(config, taskId, { status });
  }

  async addComment(config: TaskProviderConfig, taskId: string, text: string, mentionUserId?: number): Promise<void> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const body: Record<string, unknown> = { comment_text: text };
    if (mentionUserId) body.assignee = mentionUserId;

    await apiPost(`${BASE}/task/${taskId}/comment`, body, headers(config));
  }

  async addAttachment(config: TaskProviderConfig, taskId: string, fileUrl: string, filename: string): Promise<void> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    // ClickUp attachment API requires multipart/form-data
    // We download the file and re-upload it to ClickUp
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      throw { statusCode: 400, message: `Failed to download file from ${fileUrl}`, code: 'FILE_DOWNLOAD_FAILED' };
    }

    const blob = await fileResponse.blob();
    const formData = new FormData();
    formData.append('attachment', blob, filename);

    const response = await fetch(`${BASE}/task/${taskId}/attachment`, {
      method: 'POST',
      headers: { Authorization: config.apiToken },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ClickUp attachment error ${response.status}: ${body}`);
    }
  }

  async setField(config: TaskProviderConfig, taskId: string, fieldKey: string, value: unknown): Promise<void> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const fieldId = resolveCustomFieldId(config, fieldKey);
    await apiPost(
      `${BASE}/task/${taskId}/field/${fieldId}`,
      { value },
      headers(config),
    );
  }

  async setAssignees(config: TaskProviderConfig, taskId: string, assigneeEmails: string[]): Promise<void> {
    const ids: number[] = [];
    for (const email of assigneeEmails) {
      const id = resolveAssigneeId(config, email);
      if (id) ids.push(id);
    }

    if (ids.length === 0) {
      throw { statusCode: 400, message: 'No assignees could be resolved. Check assigneeMap in provider config.', code: 'ASSIGNEE_NOT_FOUND' };
    }

    await this.updateTask(config, taskId, { assignees: { add: assigneeEmails } });
  }

  async addTag(config: TaskProviderConfig, taskId: string, tag: string): Promise<void> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    await apiPost(
      `${BASE}/task/${taskId}/tag/${encodeURIComponent(tag)}`,
      {},
      headers(config),
    );
  }

  async removeTag(config: TaskProviderConfig, taskId: string, tag: string): Promise<void> {
    enforceRateLimit(rateKey(config), MAX_PER_MINUTE);

    const response = await fetch(`${BASE}/task/${taskId}/tag/${encodeURIComponent(tag)}`, {
      method: 'DELETE',
      headers: headers(config),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ClickUp remove tag error ${response.status}: ${body}`);
    }
  }
}
