import * as identityService from '../identity/identity.service.js';
import type { ProviderResource } from '../../providers/provider.interface.js';

export type QueryIntent =
  | 'deal_status'
  | 'open_tasks'
  | 'documents'
  | 'full_profile'
  | 'client_info';

export interface AgentQueryRequest {
  intent: QueryIntent;
  identifier: {
    phone?: string;
    email?: string;
    name?: string;
    groupJid?: string;
  };
  filters?: {
    provider?: string;
    status?: string;
  };
}

export interface AgentQueryResult {
  contact: {
    id: string;
    name: string | null;
    phone: string | null;
    whatsappPhone: string | null;
    email: string | null;
  };
  resources: ProviderResource[];
  meta: {
    resolvedVia: string;
    syncedAt: Date | null;
    providers: string[];
  };
}

// Map intents to resource type filters
const INTENT_RESOURCE_MAP: Record<QueryIntent, string[] | null> = {
  deal_status: ['deal'],
  open_tasks: ['task'],
  documents: ['folder'],
  full_profile: null, // all resources
  client_info: ['person', 'contact'],
};

// Map intents to provider category filters
const INTENT_CATEGORY_MAP: Record<QueryIntent, string[] | null> = {
  deal_status: ['crm'],
  open_tasks: ['tasks'],
  documents: ['documents'],
  full_profile: null,
  client_info: ['crm'],
};

export async function query(accountId: string, req: AgentQueryRequest): Promise<AgentQueryResult> {
  // Determine how we resolved the identity
  const resolvedVia = req.identifier.groupJid ? 'groupJid'
    : req.identifier.phone ? 'phone'
    : req.identifier.email ? 'email'
    : req.identifier.name ? 'name'
    : 'unknown';

  // Resolve identity (this handles sync automatically)
  const identity = await identityService.resolve(accountId, {
    phone: req.identifier.phone,
    email: req.identifier.email,
    name: req.identifier.name,
    groupJid: req.identifier.groupJid,
  });

  // Flatten all resources from all providers
  let allResources: Array<ProviderResource & { _provider: string }> = [];
  for (const [providerName, resources] of Object.entries(identity.providers)) {
    for (const resource of resources) {
      allResources.push({ ...resource, _provider: providerName });
    }
  }

  // Filter by intent
  const resourceTypes = INTENT_RESOURCE_MAP[req.intent];
  if (resourceTypes) {
    allResources = allResources.filter((r) => resourceTypes.includes(r.resourceType));
  }

  // Filter by explicit provider
  if (req.filters?.provider) {
    allResources = allResources.filter((r) => r._provider === req.filters!.provider);
  }

  // Filter by status
  if (req.filters?.status) {
    allResources = allResources.filter((r) => r.status === req.filters!.status);
  }

  // Clean up _provider from output
  const resources: ProviderResource[] = allResources.map(({ _provider, ...rest }) => rest);
  const activeProviders = [...new Set(allResources.map((r) => r._provider))];

  return {
    contact: {
      id: identity.crmContactId,
      name: identity.name,
      phone: identity.phone,
      whatsappPhone: identity.whatsappPhone,
      email: identity.email,
    },
    resources,
    meta: {
      resolvedVia,
      syncedAt: identity.lastSyncedAt,
      providers: activeProviders,
    },
  };
}
