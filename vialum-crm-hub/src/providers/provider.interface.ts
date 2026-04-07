// ════════════════════════════════════════════════════════════
// Provider Abstraction — Interface & Types
// Base interface for all external integrations.
// Category defines what the provider does:
//   crm: Pipedrive, HubSpot (deals, contacts)
//   tasks: ClickUp, Linear, Asana (task management)
//   documents: Google Drive, OneDrive (file storage)
//   marketing: RD Station (leads, campaigns)
// ════════════════════════════════════════════════════════════

export interface ProviderSearchParams {
  phone?: string;
  email?: string;
  name?: string;
  cpf?: string;
  externalId?: string;
}

export interface ProviderResource {
  externalId: string;
  externalUrl?: string;
  resourceType: string;     // deal | person | task | folder | contact | organization
  resourceName?: string;
  status?: string;
  stage?: string;
  value?: number;
  rawData: Record<string, unknown>;
}

export interface ProviderSyncResult {
  provider: string;
  resources: ProviderResource[];
  errors?: string[];
}

export interface ProviderCapabilities {
  searchByPhone: boolean;
  searchByEmail: boolean;
  searchByName: boolean;
  hasOAuth: boolean;
  resourceTypes: string[];
  category: 'crm' | 'tasks' | 'documents' | 'marketing';
}

/**
 * @deprecated Use IntegrationProvider instead. CrmProvider kept as alias for backward compat.
 */
export type CrmProvider = IntegrationProvider;

export interface IntegrationProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  testConnection(accountId: string): Promise<boolean>;
  search(accountId: string, params: ProviderSearchParams): Promise<ProviderResource[]>;
  sync(accountId: string, params: ProviderSearchParams): Promise<ProviderSyncResult>;
  getResource?(accountId: string, resourceType: string, externalId: string): Promise<ProviderResource | null>;
}
