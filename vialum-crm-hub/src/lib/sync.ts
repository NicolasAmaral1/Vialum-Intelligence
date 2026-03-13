import { getPrisma } from '../config/database.js';
import { getAllProviders } from '../providers/provider.registry.js';
import type { ProviderSearchParams, ProviderResource } from '../providers/provider.interface.js';

const SYNC_STALE_MINUTES = 30;

export function isStale(integrations: Array<{ syncedAt: Date }>): boolean {
  if (integrations.length === 0) return true;
  const newest = integrations.reduce((a, b) => (a.syncedAt > b.syncedAt ? a : b));
  const ageMs = Date.now() - new Date(newest.syncedAt).getTime();
  return ageMs > SYNC_STALE_MINUTES * 60 * 1000;
}

function canSearch(
  provider: { capabilities: { searchByPhone: boolean; searchByEmail: boolean; searchByName: boolean } },
  params: ProviderSearchParams,
): boolean {
  if (params.phone && provider.capabilities.searchByPhone) return true;
  if (params.email && provider.capabilities.searchByEmail) return true;
  if (params.name && provider.capabilities.searchByName) return true;
  return false;
}

/**
 * Sync all capable providers for a given contact.
 * Returns list of created/updated integration keys (e.g. "pipedrive:deal-123").
 */
export async function syncProviders(
  accountId: string,
  crmContactId: string,
  params: ProviderSearchParams,
): Promise<string[]> {
  const prisma = getPrisma();
  const providers = getAllProviders().filter((p) => canSearch(p, params));
  const synced: string[] = [];

  const results = await Promise.allSettled(
    providers.map((p) => p.sync(accountId, params)),
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { provider, resources } = result.value;

    for (const resource of resources) {
      try {
        await upsertIntegration(prisma, crmContactId, provider, resource);
        synced.push(`${provider}:${resource.externalId}`);
      } catch {
        // Skip individual upsert failures
      }
    }
  }

  return synced;
}

async function upsertIntegration(
  prisma: ReturnType<typeof getPrisma>,
  crmContactId: string,
  provider: string,
  resource: ProviderResource,
) {
  await prisma.crmIntegration.upsert({
    where: {
      crmContactId_provider_externalId: {
        crmContactId,
        provider,
        externalId: resource.externalId,
      },
    },
    create: {
      crmContactId,
      provider,
      externalId: resource.externalId,
      externalUrl: resource.externalUrl ?? null,
      resourceType: resource.resourceType,
      resourceName: resource.resourceName ?? null,
      status: resource.status ?? null,
      stage: resource.stage ?? null,
      value: resource.value ?? null,
      rawData: (resource.rawData ?? {}) as any,
    },
    update: {
      externalUrl: resource.externalUrl ?? null,
      resourceName: resource.resourceName ?? null,
      status: resource.status ?? null,
      stage: resource.stage ?? null,
      value: resource.value ?? null,
      rawData: (resource.rawData ?? {}) as any,
      syncedAt: new Date(),
    },
  });
}
