export interface CrmIntegrationSummary {
  id: string;
  provider: 'pipedrive' | 'clickup' | 'gdrive';
  externalId: string;
  resourceType: string;
  resourceName: string | null;
  externalUrl: string | null;
  status: string | null;
  stage: string | null;
  value: number | null;
  syncedAt: string;
  rawData: Record<string, unknown>;
}

export interface ContactCrmSummary {
  crmContactId: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  integrations: CrmIntegrationSummary[];
}
