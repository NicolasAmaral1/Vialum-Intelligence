// ════════════════════════════════════════════════════════════
// Alias Type Registry
// Defines known alias types for identity resolution.
// New providers = add to this list + deploy.
// Tenants can use custom:* prefix for unknown types.
// ════════════════════════════════════════════════════════════

/** Standard identity aliases */
const IDENTITY_TYPES = [
  'phone',
  'email',
  'cpf',
  'cnpj',
] as const;

/** Provider-specific external ID aliases */
const PROVIDER_TYPES = [
  'pipedrive_person',
  'pipedrive_deal',
  'pipedrive_organization',
  'rdstation_contact',
  'rdstation_deal',
  'rdstation_organization',
  'clickup_member',
  'clickup_task',
  'gdrive_folder',
  'hubspot_contact',
  'hubspot_deal',
] as const;

/** Source service aliases (which service created/owns this contact) */
const SOURCE_TYPES = [
  'source:vialum_chat',
  'source:vialum_portal',
  'source:vialum_media',
  'source:external_api',
] as const;

export const KNOWN_ALIAS_TYPES = [
  ...IDENTITY_TYPES,
  ...PROVIDER_TYPES,
  ...SOURCE_TYPES,
] as const;

export type KnownAliasType = typeof KNOWN_ALIAS_TYPES[number];

/**
 * Validates an alias type. Accepts:
 * - Any known type from the registry
 * - Any string with `custom:` prefix (extensible)
 * - Any string with `source:` prefix (service sources)
 */
export function isValidAliasType(type: string): boolean {
  if (KNOWN_ALIAS_TYPES.includes(type as KnownAliasType)) return true;
  if (type.startsWith('custom:')) return true;
  if (type.startsWith('source:')) return true;
  return false;
}

/**
 * Name source priority — higher number = higher priority.
 * Used to decide whether to overwrite a contact's name.
 */
export const NAME_SOURCE_PRIORITY: Record<string, number> = {
  unknown: 0,
  whatsapp: 1,
  chat: 2,
  task: 3,
  crm: 4,
  manual: 5,
};

/**
 * Returns true if newSource should overwrite existingSource.
 */
export function shouldOverwriteName(existingSource: string, newSource: string): boolean {
  const existingPriority = NAME_SOURCE_PRIORITY[existingSource] ?? 0;
  const newPriority = NAME_SOURCE_PRIORITY[newSource] ?? 0;
  return newPriority >= existingPriority;
}

/**
 * Extracts the raw external ID from a provider's externalId format.
 * Pipedrive: "person-123" → "123"
 * RD Station: "contact-456" → "456"
 * Generic: strips "{resourceType}-" prefix if present.
 */
export function extractRawExternalId(externalId: string, resourceType?: string): string {
  if (resourceType && externalId.startsWith(`${resourceType}-`)) {
    return externalId.slice(resourceType.length + 1);
  }
  // Try generic prefix strip (word-digits pattern)
  const match = externalId.match(/^[a-z_]+-(.+)$/);
  return match ? match[1] : externalId;
}

/**
 * Builds the alias type for a provider's external ID.
 * provider: "pipedrive", resourceType: "person" → "pipedrive_person"
 */
export function buildProviderAliasType(provider: string, resourceType: string): string {
  return `${provider}_${resourceType}`;
}
