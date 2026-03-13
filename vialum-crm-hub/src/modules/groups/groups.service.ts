import { getPrisma } from '../../config/database.js';

export async function registerGroupMapping(
  accountId: string,
  data: { groupJid: string; crmContactId: string; groupName?: string; groupType?: string },
) {
  const prisma = getPrisma();

  return prisma.whatsAppGroupMapping.upsert({
    where: { accountId_groupJid: { accountId, groupJid: data.groupJid } },
    create: {
      accountId,
      crmContactId: data.crmContactId,
      groupJid: data.groupJid,
      groupName: data.groupName ?? null,
      groupType: data.groupType ?? 'client',
    },
    update: {
      crmContactId: data.crmContactId,
      ...(data.groupName !== undefined && { groupName: data.groupName }),
      ...(data.groupType !== undefined && { groupType: data.groupType }),
    },
  });
}

export async function resolveByGroupJid(accountId: string, groupJid: string) {
  const prisma = getPrisma();

  const mapping = await prisma.whatsAppGroupMapping.findUnique({
    where: { accountId_groupJid: { accountId, groupJid } },
    include: {
      contact: {
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
      },
    },
  });

  if (!mapping) return null;

  return mapping;
}

export async function listGroupsForContact(accountId: string, crmContactId: string) {
  const prisma = getPrisma();

  return prisma.whatsAppGroupMapping.findMany({
    where: { accountId, crmContactId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function removeGroupMapping(accountId: string, groupJid: string) {
  const prisma = getPrisma();

  const existing = await prisma.whatsAppGroupMapping.findUnique({
    where: { accountId_groupJid: { accountId, groupJid } },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Group mapping not found', code: 'GROUP_MAPPING_NOT_FOUND' };
  }

  return prisma.whatsAppGroupMapping.delete({
    where: { accountId_groupJid: { accountId, groupJid } },
  });
}
