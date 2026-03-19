export interface ClickUpConfig {
  apiToken: string; // Personal or OAuth token
}

export interface ClickUpTask {
  id: string;
  name: string;
  description?: string;
  status: { status: string; color: string };
  url: string;
  list: { id: string; name: string };
  folder?: { id: string; name: string };
  space?: { id: string };
  assignees?: Array<{ id: number; username?: string; email?: string }>;
  tags?: Array<{ name: string }>;
  date_created?: string;
  date_updated?: string;
  custom_fields?: Array<{
    id: string;
    name: string;
    type: string;
    value?: unknown;
  }>;
  [key: string]: unknown;  // allow additional fields from API
}

export interface ClickUpSearchResult {
  tasks: ClickUpTask[];
}
