import { getPrisma } from '../../config/database.js';

export async function findByVialumContactId(accountId: string, externalSourceId: string) {
  const prisma = getPrisma();

  return prisma.crmContact.findFirst({
    where: { accountId, externalSourceId },
    include: { integrations: { where: { active: true }, orderBy: { createdAt: 'desc' } } },
  });
}

export async function getSummary(
  accountId: string,
  externalSourceId: string,
  opts?: { phone?: string; name?: string; email?: string },
) {
  const prisma = getPrisma();

  // Find or create contact
  let contact = await prisma.crmContact.findFirst({
    where: { accountId, externalSourceId },
    include: {
      integrations: {
        where: { active: true },
        select: {
          id: true, provider: true, externalId: true, resourceType: true,
          resourceName: true, externalUrl: true, status: true, stage: true,
          value: true, syncedAt: true, rawData: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!contact) {
    contact = await prisma.crmContact.create({
      data: {
        accountId,
        externalSourceId,
        phone: opts?.phone ?? null,
        email: opts?.email ?? null,
        name: opts?.name ?? null,
      },
      include: {
        integrations: {
          where: { active: true },
          select: {
            id: true, provider: true, externalId: true, resourceType: true,
            resourceName: true, externalUrl: true, status: true, stage: true,
            value: true, syncedAt: true, rawData: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  } else if (opts?.phone || opts?.email || opts?.name) {
    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        ...(opts?.phone && { phone: opts.phone }),
        ...(opts?.email && { email: opts.email }),
        ...(opts?.name && { name: opts.name }),
      },
    });
  }

  return {
    crmContactId: contact.id,
    tags: contact.tags,
    metadata: contact.metadata,
    integrations: contact.integrations,
  };
}

export async function lookup(accountId: string, data: { externalSourceId: string; phone?: string; email?: string; name?: string }) {
  const prisma = getPrisma();

  let contact = await prisma.crmContact.findFirst({
    where: { accountId, externalSourceId: data.externalSourceId },
    include: { integrations: { where: { active: true } } },
  });

  if (!contact) {
    contact = await prisma.crmContact.create({
      data: {
        accountId,
        externalSourceId: data.externalSourceId,
        phone: data.phone ?? null,
        email: data.email ?? null,
        name: data.name ?? null,
      },
      include: { integrations: { where: { active: true } } },
    });
  } else {
    await prisma.crmContact.update({
      where: { id: contact.id },
      data: {
        ...(data.phone && { phone: data.phone }),
        ...(data.email && { email: data.email }),
        ...(data.name && { name: data.name }),
      },
    });
  }

  return contact;
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
    include: { integrations: { where: { active: true } } },
  });
}
