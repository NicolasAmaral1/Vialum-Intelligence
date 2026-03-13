export interface ClickUpConfig {
  apiToken: string; // Personal or OAuth token
}

export interface ClickUpTask {
  id: string;
  name: string;
  status: { status: string; color: string };
  url: string;
  list: { id: string; name: string };
  folder?: { id: string; name: string };
  space?: { id: string };
  custom_fields?: Array<{
    id: string;
    name: string;
    type: string;
    value?: unknown;
  }>;
}

export interface ClickUpSearchResult {
  tasks: ClickUpTask[];
}
