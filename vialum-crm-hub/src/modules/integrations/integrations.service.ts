import { getPrisma } from '../../config/database.js';

export interface CreateIntegrationInput {
  provider: string;
  externalId: string;
  externalUrl?: string;
  resourceType: string;
  resourceName?: string;
  status?: string;
  stage?: string;
  value?: number;
  rawData?: Record<string, unknown>;
}

export async function listByContact(accountId: string, externalSourceId: string) {
  const prisma = getPrisma();

  const contact = await prisma.crmContact.findFirst({
    where: { accountId, externalSourceId },
  });

  if (!contact) return [];

  return prisma.crmIntegration.findMany({
    where: { crmContactId: contact.id, active: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(accountId: string, externalSourceId: string, data: CreateIntegrationInput) {
  const prisma = getPrisma();

  // Find or create CrmContact
  let contact = await prisma.crmContact.findFirst({
    where: { accountId, externalSourceId },
  });

  if (!contact) {
    contact = await prisma.crmContact.create({
      data: { accountId, externalSourceId },
    });
  }

  // Upsert integration (unique on contact + provider + externalId)
  return prisma.crmIntegration.upsert({
    where: {
      crmContactId_provider_externalId: {
        crmContactId: contact.id,
        provider: data.provider,
        externalId: data.externalId,
      },
    },
    create: {
      crmContactId: contact.id,
      provider: data.provider,
      externalId: data.externalId,
      externalUrl: data.externalUrl ?? null,
      resourceType: data.resourceType,
      resourceName: data.resourceName ?? null,
      status: data.status ?? null,
      stage: data.stage ?? null,
      value: data.value ?? null,
      rawData: (data.rawData ?? {}) as any,
    },
    update: {
      externalUrl: data.externalUrl ?? undefined,
      resourceName: data.resourceName ?? undefined,
      status: data.status ?? undefined,
      stage: data.stage ?? undefined,
      value: data.value ?? undefined,
      rawData: data.rawData ? (data.rawData as any) : undefined,
      syncedAt: new Date(),
      active: true, // reactivate if was inactive
    },
  });
}

export async function remove(accountId: string, integrationId: string) {
  const prisma = getPrisma();

  const integration = await prisma.crmIntegration.findFirst({
    where: { id: integrationId },
    include: { contact: { select: { accountId: true } } },
  });

  if (!integration || integration.contact.accountId !== accountId) {
    throw { statusCode: 404, message: 'Integration not found', code: 'INTEGRATION_NOT_FOUND' };
  }

  await prisma.crmIntegration.delete({ where: { id: integrationId } });
}
