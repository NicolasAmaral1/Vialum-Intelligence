import crypto from 'crypto';
import { getPrisma } from '../../config/database.js';
import { normalizePhone, toWhatsApp } from '../../lib/phone.js';
import { syncProviders, isStale } from '../../lib/sync.js';
import type { ProviderSearchParams, ProviderResource } from '../../providers/provider.interface.js';

export interface ResolveRequest {
  phone?: string;
  email?: string;
  name?: string;
  cpf?: string;
  externalId?: string;
  provider?: string;
  groupJid?: string;
  forceSync?: boolean;
}

export interface ResolvedIdentity {
  crmContactId: string;
  name: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  aliases: Array<{ type: string; value: string; isPrimary: boolean }>;
  providers: Record<string, ProviderResource[]>;
  lastSyncedAt: Date | null;
}

export async function resolve(accountId: string, req: ResolveRequest): Promise<ResolvedIdentity> {
  const prisma = getPrisma();

  // ── Step 0: WhatsApp group JID lookup ──
  if (req.groupJid) {
    const groupMapping = await prisma.whatsAppGroupMapping.findUnique({
      where: { accountId_groupJid: { accountId, groupJid: req.groupJid } },
      select: { crmContactId: true },
    });
    if (groupMapping) {
      // Use the mapped contact directly — skip alias/phone/email resolution
      const contact = await prisma.crmContact.findUniqueOrThrow({
        where: { id: groupMapping.crmContactId },
        include: {
          aliases: { select: { type: true, value: true, isPrimary: true } },
          integrations: {
            select: {
              provider: true,
              externalId: true,
              externalUrl: true,
              resourceType: true,
              resourceName: true,
              status: true,
              stage: true,
              value: true,
              syncedAt: true,
              rawData: true,
            },
            orderBy: { syncedAt: 'desc' },
          },
        },
      });

      const providers: Record<string, ProviderResource[]> = {};
      for (const integration of contact.integrations) {
        if (!providers[integration.provider]) providers[integration.provider] = [];
        providers[integration.provider].push({
          externalId: integration.externalId,
          externalUrl: integration.externalUrl ?? undefined,
          resourceType: integration.resourceType,
          resourceName: integration.resourceName ?? undefined,
          status: integration.status ?? undefined,
          stage: integration.stage ?? undefined,
          value: integration.value ? Number(integration.value) : undefined,
          rawData: integration.rawData as Record<string, unknown>,
        });
      }

      return {
        crmContactId: contact.id,
        name: contact.name,
        phone: contact.phone,
        whatsappPhone: contact.phone ? toWhatsApp(contact.phone) : null,
        email: contact.email,
        aliases: contact.aliases,
        providers,
        lastSyncedAt: contact.integrations.length > 0 ? contact.integrations[0].syncedAt : null,
      };
    }
  }

  // ── Step 1: Normalize identifiers ──
  const normalizedPhone = req.phone ? normalizePhone(req.phone) : undefined;
  const normalizedEmail = req.email?.toLowerCase().trim();

  // ── Step 2: Find existing contact via aliases ──
  let crmContactId: string | null = null;

  // Try alias lookup (fast, indexed)
  const aliasQueries: Array<{ type: string; value: string }> = [];
  if (normalizedPhone) aliasQueries.push({ type: 'phone', value: normalizedPhone });
  if (normalizedEmail) aliasQueries.push({ type: 'email', value: normalizedEmail });
  if (req.cpf) aliasQueries.push({ type: 'cpf', value: req.cpf.replace(/\D/g, '') });

  if (aliasQueries.length > 0) {
    const alias = await prisma.contactAlias.findFirst({
      where: {
        accountId,
        OR: aliasQueries.map((q) => ({ type: q.type, value: q.value })),
      },
      select: { crmContactId: true },
    });
    if (alias) crmContactId = alias.crmContactId;
  }

  // Try externalId lookup in CrmIntegration
  if (!crmContactId && req.externalId && req.provider) {
    const integration = await prisma.crmIntegration.findFirst({
      where: {
        provider: req.provider,
        externalId: req.externalId,
        contact: { accountId },
      },
      select: { crmContactId: true },
    });
    if (integration) crmContactId = integration.crmContactId;
  }

  // Try direct phone/email match on CrmContact (backward compat)
  if (!crmContactId) {
    const where: Record<string, unknown> = { accountId };
    if (normalizedPhone) where.phone = normalizedPhone;
    else if (normalizedEmail) where.email = normalizedEmail;
    else if (req.name) where.name = req.name;

    if (Object.keys(where).length > 1) {
      const contact = await prisma.crmContact.findFirst({
        where,
        select: { id: true },
      });
      if (contact) crmContactId = contact.id;
    }
  }

  // ── Step 3: Create contact if not found ──
  if (!crmContactId) {
    const newContact = await prisma.crmContact.create({
      data: {
        accountId,
        vialumContactId: crypto.randomUUID(), // generate placeholder until linked
        phone: normalizedPhone ?? null,
        email: normalizedEmail ?? null,
        name: req.name ?? null,
      },
    });
    crmContactId = newContact.id;

    // Create aliases for the new contact
    for (const alias of aliasQueries) {
      await prisma.contactAlias.upsert({
        where: { accountId_type_value: { accountId, type: alias.type, value: alias.value } },
        create: { crmContactId, accountId, type: alias.type, value: alias.value, isPrimary: true },
        update: {},
      }).catch(() => {}); // skip if alias already exists for another contact
    }
  } else {
    // Update contact name if previously null and now provided
    if (req.name) {
      const existing = await prisma.crmContact.findUnique({ where: { id: crmContactId }, select: { name: true } });
      if (existing && !existing.name) {
        await prisma.crmContact.update({ where: { id: crmContactId }, data: { name: req.name } });
      }
    }

    // Ensure aliases exist for known identifiers
    for (const alias of aliasQueries) {
      await prisma.contactAlias.upsert({
        where: { accountId_type_value: { accountId, type: alias.type, value: alias.value } },
        create: { crmContactId, accountId, type: alias.type, value: alias.value, isPrimary: false },
        update: {},
      }).catch(() => {});
    }
  }

  // ── Step 4: Get contact with integrations ──
  const contact = await prisma.crmContact.findUniqueOrThrow({
    where: { id: crmContactId },
    include: {
      aliases: { select: { type: true, value: true, isPrimary: true } },
      integrations: {
        select: {
          provider: true,
          externalId: true,
          externalUrl: true,
          resourceType: true,
          resourceName: true,
          status: true,
          stage: true,
          value: true,
          syncedAt: true,
          rawData: true,
        },
        orderBy: { syncedAt: 'desc' },
      },
    },
  });

  // ── Step 5: Sync if stale or forced ──
  const needsSync = req.forceSync || contact.integrations.length === 0 || isStale(contact.integrations);

  if (needsSync) {
    const searchParams: ProviderSearchParams = {
      phone: normalizedPhone ?? contact.phone ?? undefined,
      email: normalizedEmail ?? contact.email ?? undefined,
      name: req.name ?? contact.name ?? undefined,
    };

    if (searchParams.phone || searchParams.email || searchParams.name) {
      await syncProviders(accountId, crmContactId, searchParams);

      // Re-fetch integrations after sync
      const updatedIntegrations = await prisma.crmIntegration.findMany({
        where: { crmContactId },
        select: {
          provider: true,
          externalId: true,
          externalUrl: true,
          resourceType: true,
          resourceName: true,
          status: true,
          stage: true,
          value: true,
          syncedAt: true,
          rawData: true,
        },
        orderBy: { syncedAt: 'desc' },
      });
      contact.integrations = updatedIntegrations;
    }
  }

  // ── Step 6: Group by provider ──
  const providers: Record<string, ProviderResource[]> = {};
  for (const integration of contact.integrations) {
    if (!providers[integration.provider]) providers[integration.provider] = [];
    providers[integration.provider].push({
      externalId: integration.externalId,
      externalUrl: integration.externalUrl ?? undefined,
      resourceType: integration.resourceType,
      resourceName: integration.resourceName ?? undefined,
      status: integration.status ?? undefined,
      stage: integration.stage ?? undefined,
      value: integration.value ? Number(integration.value) : undefined,
      rawData: integration.rawData as Record<string, unknown>,
    });
  }

  const lastSyncedAt = contact.integrations.length > 0
    ? contact.integrations[0].syncedAt
    : null;

  return {
    crmContactId,
    name: contact.name,
    phone: contact.phone,
    whatsappPhone: contact.phone ? toWhatsApp(contact.phone) : null,
    email: contact.email,
    aliases: contact.aliases,
    providers,
    lastSyncedAt,
  };
}

