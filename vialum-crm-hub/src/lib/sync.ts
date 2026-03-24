import { getPrisma } from '../config/database.js';
import { getAllProviders } from '../providers/provider.registry.js';
import type { ProviderSearchParams, ProviderResource } from '../providers/provider.interface.js';
import { buildProviderAliasType, extractRawExternalId } from './alias-types.js';

const SYNC_STALE_MINUTES = 60; // 1 hour default

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
 * Sync providers for a given contact.
 * Filters by tenant's active providers before iterating.
 * Saves external IDs as aliases for reverse lookup.
 */
export async function syncProviders(
  accountId: string,
  crmContactId: string,
  params: ProviderSearchParams,
): Promise<string[]> {
  const prisma = getPrisma();

  // Only sync active providers for this tenant
  const activeConfigs = await prisma.providerConfig.findMany({
    where: { accountId, active: true },
    select: { provider: true },
  });
  const activeProviderNames = new Set(activeConfigs.map((c) => c.provider));

  const providers = getAllProviders().filter(
    (p) => activeProviderNames.has(p.name) && canSearch(p, params),
  );

  if (providers.length === 0) return [];

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

        // Save external ID as alias for reverse lookup
        await saveExternalIdAlias(prisma, accountId, crmContactId, provider, resource);
      } catch (err) {
        console.error(`[sync] Failed to upsert ${provider}:${resource.externalId}:`, (err as Error).message);
      }
    }

    // Update lastSyncAt for this provider
    await prisma.providerConfig.updateMany({
      where: { accountId, provider },
      data: { lastSyncAt: new Date() },
    }).catch(() => {});
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
      active: true,
    },
    update: {
      externalUrl: resource.externalUrl ?? null,
      resourceName: resource.resourceName ?? null,
      status: resource.status ?? null,
      stage: resource.stage ?? null,
      value: resource.value ?? null,
      rawData: (resource.rawData ?? {}) as any,
      syncedAt: new Date(),
      active: true,
    },
  });
}

/**
 * Save external ID as a ContactAlias for reverse lookup.
 * e.g., pipedrive_person:12345 → can find this contact by Pipedrive person ID.
 */
async function saveExternalIdAlias(
  prisma: ReturnType<typeof getPrisma>,
  accountId: string,
  crmContactId: string,
  provider: string,
  resource: ProviderResource,
) {
  const aliasType = buildProviderAliasType(provider, resource.resourceType);
  const rawId = extractRawExternalId(resource.externalId, resource.resourceType);

  await prisma.contactAlias.upsert({
    where: { accountId_type_value: { accountId, type: aliasType, value: rawId } },
    create: { accountId, crmContactId, type: aliasType, value: rawId },
    update: { crmContactId }, // update contact link if it changed
  }).catch(() => {}); // ignore conflicts
}
