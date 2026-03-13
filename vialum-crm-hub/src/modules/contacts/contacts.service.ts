import { getPrisma } from '../../config/database.js';
import { syncProviders, isStale } from '../../lib/sync.js';

export async function findByVialumContactId(accountId: string, vialumContactId: string) {
  const prisma = getPrisma();

  return prisma.crmContact.findUnique({
    where: { accountId_vialumContactId: { accountId, vialumContactId } },
    include: { integrations: { orderBy: { createdAt: 'desc' } } },
  });
}

export async function getSummary(
  accountId: string,
  vialumContactId: string,
  opts?: { phone?: string; name?: string; email?: string },
) {
  const prisma = getPrisma();

  // Upsert CrmContact so we always have a record
  const contact = await prisma.crmContact.upsert({
    where: { accountId_vialumContactId: { accountId, vialumContactId } },
    create: {
      accountId,
      vialumContactId,
      phone: opts?.phone ?? null,
      email: opts?.email ?? null,
      name: opts?.name ?? null,
    },
    update: {
      ...(opts?.phone && { phone: opts.phone }),
      ...(opts?.email && { email: opts.email }),
      ...(opts?.name && { name: opts.name }),
    },
    include: {
      integrations: {
        select: {
          id: true,
          provider: true,
          externalId: true,
          resourceType: true,
          resourceName: true,
          externalUrl: true,
          status: true,
          stage: true,
          value: true,
          syncedAt: true,
          rawData: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  // Check if we need auto-sync (no integrations or stale)
  const needsSync = contact.integrations.length === 0 || isStale(contact.integrations);

  if (needsSync && (opts?.phone || opts?.name || opts?.email)) {
    const synced = await syncProviders(accountId, contact.id, {
      phone: opts?.phone,
      name: opts?.name,
      email: opts?.email,
    });
    if (synced.length > 0) {
      // Re-fetch integrations after sync
      const updated = await prisma.crmIntegration.findMany({
        where: { crmContactId: contact.id },
        select: {
          id: true,
          provider: true,
          externalId: true,
          resourceType: true,
          resourceName: true,
          externalUrl: true,
          status: true,
          stage: true,
          value: true,
          syncedAt: true,
          rawData: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        crmContactId: contact.id,
        tags: contact.tags,
        metadata: contact.metadata,
        integrations: updated,
      };
    }
  }

  return {
    crmContactId: contact.id,
    tags: contact.tags,
    metadata: contact.metadata,
    integrations: contact.integrations,
  };
}

export async function lookup(accountId: string, data: { vialumContactId: string; phone?: string; email?: string; name?: string }) {
  const prisma = getPrisma();

  // Upsert: find or create CrmContact
  return prisma.crmContact.upsert({
    where: { accountId_vialumContactId: { accountId, vialumContactId: data.vialumContactId } },
    create: {
      accountId,
      vialumContactId: data.vialumContactId,
      phone: data.phone ?? null,
      email: data.email ?? null,
      name: data.name ?? null,
    },
    update: {
      ...(data.phone && { phone: data.phone }),
      ...(data.email && { email: data.email }),
      ...(data.name && { name: data.name }),
    },
    include: { integrations: true },
  });
}

export async function update(accountId: string, id: string, data: { tags?: string[]; metadata?: Record<string, unknown> }) {
  const prisma = getPrisma();

  const existing = await prisma.crmContact.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'CRM contact not found', code: 'CRM_CONTACT_NOT_FOUND' };
  }

  return prisma.crmContact.update({
    where: { id },
    data: {
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.metadata !== undefined && { metadata: data.metadata as any }),
    },
    include: { integrations: true },
  });
}
