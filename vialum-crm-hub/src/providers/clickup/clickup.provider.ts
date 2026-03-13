import { BaseProvider } from '../provider.base.js';
import { apiGet } from '../../lib/http.js';
import type { ProviderCapabilities, ProviderSearchParams, ProviderResource } from '../provider.interface.js';
import type { ClickUpConfig, ClickUpTask } from './clickup.types.js';

const BASE_URL = 'https://api.clickup.com/api/v2';

export class ClickUpProvider extends BaseProvider<ClickUpConfig> {
  readonly name = 'clickup';
  readonly capabilities: ProviderCapabilities = {
    searchByPhone: false,
    searchByEmail: false,
    searchByName: true,
    hasOAuth: false,
    resourceTypes: ['task'],
    category: 'tasks',
  };

  private headers(config: ClickUpConfig): Record<string, string> {
    return { Authorization: config.apiToken };
  }

  async testConnection(accountId: string): Promise<boolean> {
    const config = await this.getConfig(accountId);
    try {
      const result = await apiGet<{ user: { id: number } }>(`${BASE_URL}/user`, this.headers(config));
      return !!result.user?.id;
    } catch {
      return false;
    }
  }

  async search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]> {
    if (!params.name) return [];

    const config = await this.getConfig(accountId);
    const tasks = await this.searchTasks(config, params.name);

    return tasks.slice(0, 5).map((task) => ({
      externalId: task.id,
      externalUrl: task.url,
      resourceType: 'task',
      resourceName: task.name,
      status: task.status?.status ?? undefined,
      rawData: task as unknown as Record<string, unknown>,
    }));
  }

  // ── Helpers (exposed for backward-compat routes) ──

  async searchTasks(configOrAccountId: ClickUpConfig | string, query: string, listId?: string): Promise<ClickUpTask[]> {
    let config: ClickUpConfig;
    if (typeof configOrAccountId === 'string') {
      config = await this.getConfig(configOrAccountId);
    } else {
      config = configOrAccountId;
    }

    const teamsResult = await apiGet<{ teams: Array<{ id: string }> }>(`${BASE_URL}/team`, this.headers(config));
    const teamId = teamsResult.teams?.[0]?.id;
    if (!teamId) return [];

    const searchParams = new URLSearchParams({ query });
    if (listId) searchParams.set('list_ids[]', listId);

    const url = `${BASE_URL}/team/${teamId}/task?${searchParams.toString()}&include_closed=true&subtasks=true`;
    try {
      const result = await apiGet<{ tasks: ClickUpTask[] }>(url, this.headers(config));
      return result.tasks ?? [];
    } catch {
      return [];
    }
  }

  async getTask(accountId: string, taskId: string): Promise<ClickUpTask | null> {
    const config = await this.getConfig(accountId);
    const url = `${BASE_URL}/task/${taskId}?include_subtasks=true`;
    try {
      return await apiGet<ClickUpTask>(url, this.headers(config));
    } catch {
      return null;
    }
  }
}
