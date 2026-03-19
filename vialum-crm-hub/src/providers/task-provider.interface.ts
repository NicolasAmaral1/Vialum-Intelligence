// ════════════════════════════════════════════════════════════
// Task Provider — Agnostic interface for task management
// Providers: ClickUp, Linear, Asana, Notion, Monday (future)
// ════════════════════════════════════════════════════════════

export interface CreateTaskParams {
  name: string;
  description?: string;
  status?: string;
  assignees?: string[];
  tags?: string[];
  customFields?: Array<{ key: string; value: unknown }>;
  providerParams?: Record<string, unknown>;
}

export interface UpdateTaskParams {
  name?: string;
  description?: string;
  status?: string;
  assignees?: { add?: string[]; remove?: string[] };
  tags?: { add?: string[]; remove?: string[] };
}

export interface TaskResource {
  id: string;
  provider: string;
  name: string;
  description?: string;
  status: string;
  assignees: string[];
  tags: string[];
  customFields: Record<string, unknown>;
  externalUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskMember {
  id: string;
  name: string;
  email?: string;
}

export interface TaskProviderConfig {
  apiToken: string;
  defaults?: {
    listId?: string;
    assigneeMap?: Record<string, number>;
    customFieldMap?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface TaskProvider {
  readonly name: string;

  // Read
  getTask(config: TaskProviderConfig, taskId: string): Promise<TaskResource | null>;
  searchTasks(config: TaskProviderConfig, query: string, listId?: string): Promise<TaskResource[]>;
  getMembers(config: TaskProviderConfig): Promise<TaskMember[]>;

  // Write
  createTask(config: TaskProviderConfig, params: CreateTaskParams): Promise<TaskResource>;
  updateTask(config: TaskProviderConfig, taskId: string, params: UpdateTaskParams): Promise<TaskResource>;
  updateStatus(config: TaskProviderConfig, taskId: string, status: string): Promise<TaskResource>;
  addComment(config: TaskProviderConfig, taskId: string, text: string, mentionUserId?: number): Promise<void>;
  addAttachment(config: TaskProviderConfig, taskId: string, fileUrl: string, filename: string): Promise<void>;
  setField(config: TaskProviderConfig, taskId: string, fieldKey: string, value: unknown): Promise<void>;
  setAssignees(config: TaskProviderConfig, taskId: string, assigneeIds: string[]): Promise<void>;
  addTag(config: TaskProviderConfig, taskId: string, tag: string): Promise<void>;
  removeTag(config: TaskProviderConfig, taskId: string, tag: string): Promise<void>;
}
