// ════════════════════════════════════════════════════════════
// Organizations Service — CRUD + contact linking
// ════════════════════════════════════════════════════════════

import { getPrisma } from '../../config/database.js';

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export async function create(accountId: string, data: {
  legalName?: string;
  tradeName?: string;
  cnpj?: string;
  lifecycleStage?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const cnpj = data.cnpj ? normalizeCnpj(data.cnpj) : null;

  // Check if org with same CNPJ already exists
  if (cnpj) {
    const existing = await prisma.crmOrganization.findUnique({
      where: { accountId_cnpj: { accountId, cnpj } },
      include: { aliases: true, contacts: { include: { contact: true } } },
    });
    if (existing) return existing;
  }

  const org = await prisma.crmOrganization.create({
    data: {
      accountId,
      legalName: data.legalName ?? null,
      tradeName: data.tradeName ?? null,
      cnpj,
      lifecycleStage: data.lifecycleStage ?? 'lead',
      metadata: (data.metadata ?? {}) as any,
    },
    include: { aliases: true, contacts: true },
  });

  // Create aliases
  const aliases: Array<{ type: string; value: string; isPrimary: boolean }> = [];
  if (cnpj) aliases.push({ type: 'cnpj', value: cnpj, isPrimary: true });
  if (data.tradeName) aliases.push({ type: 'trade_name', value: data.tradeName.toLowerCase(), isPrimary: true });

  for (const alias of aliases) {
    await prisma.organizationAlias.upsert({
      where: { accountId_type_value: { accountId, type: alias.type, value: alias.value } },
      create: { organizationId: org.id, accountId, ...alias },
      update: {},
    });
  }

  return prisma.crmOrganization.findUnique({
    where: { id: org.id },
    include: { aliases: true, contacts: { include: { contact: true } } },
  });
}

export async function getById(accountId: string, orgId: string) {
  const prisma = getPrisma();
  return prisma.crmOrganization.findFirst({
    where: { id: orgId, accountId },
    include: { aliases: true, contacts: { include: { contact: true } } },
  });
}

export async function getByCnpj(accountId: string, cnpj: string) {
  const prisma = getPrisma();
  const normalized = normalizeCnpj(cnpj);
  return prisma.crmOrganization.findUnique({
    where: { accountId_cnpj: { accountId, cnpj: normalized } },
    include: { aliases: true, contacts: { include: { contact: true } } },
  });
}

export async function update(accountId: string, orgId: string, data: {
  legalName?: string;
  tradeName?: string;
  lifecycleStage?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  return prisma.crmOrganization.update({
    where: { id: orgId },
    data: {
      ...(data.legalName !== undefined && { legalName: data.legalName }),
      ...(data.tradeName !== undefined && { tradeName: data.tradeName }),
      ...(data.lifecycleStage !== undefined && { lifecycleStage: data.lifecycleStage }),
      ...(data.metadata !== undefined && { metadata: data.metadata as any }),
    },
    include: { aliases: true, contacts: { include: { contact: true } } },
  });
}

export async function linkContact(accountId: string, contactId: string, organizationId: string, role: string = 'representante', isPrimary: boolean = false) {
  const prisma = getPrisma();

  // Verify both exist and belong to this account
  const [contact, org] = await Promise.all([
    prisma.crmContact.findFirst({ where: { id: contactId, accountId } }),
    prisma.crmOrganization.findFirst({ where: { id: organizationId, accountId } }),
  ]);

  if (!contact) throw { statusCode: 404, message: 'Contact not found', code: 'CONTACT_NOT_FOUND' };
  if (!org) throw { statusCode: 404, message: 'Organization not found', code: 'ORG_NOT_FOUND' };

  return prisma.contactOrganization.upsert({
    where: { contactId_organizationId: { contactId, organizationId } },
    create: { contactId, organizationId, accountId, role, isPrimary },
    update: { role, isPrimary },
    include: { contact: true, organization: true },
  });
}

export async function unlinkContact(accountId: string, contactId: string, organizationId: string) {
  const prisma = getPrisma();
  await prisma.contactOrganization.deleteMany({
    where: { contactId, organizationId, accountId },
  });
}

export async function getContactOrganizations(accountId: string, contactId: string) {
  const prisma = getPrisma();
  return prisma.contactOrganization.findMany({
    where: { contactId, accountId },
    include: { organization: true },
  });
}

export async function getOrganizationContacts(accountId: string, orgId: string) {
  const prisma = getPrisma();
  return prisma.contactOrganization.findMany({
    where: { organizationId: orgId, accountId },
    include: { contact: true },
  });
}

export async function resolveByIdentifier(accountId: string, identifier: { cnpj?: string; tradeName?: string }) {
  const prisma = getPrisma();

  if (identifier.cnpj) {
    const normalized = normalizeCnpj(identifier.cnpj);
    const alias = await prisma.organizationAlias.findUnique({
      where: { accountId_type_value: { accountId, type: 'cnpj', value: normalized } },
      include: { organization: { include: { contacts: { include: { contact: true } }, aliases: true } } },
    });
    return alias?.organization ?? null;
  }

  if (identifier.tradeName) {
    const alias = await prisma.organizationAlias.findFirst({
      where: { accountId, type: 'trade_name', value: identifier.tradeName.toLowerCase() },
      include: { organization: { include: { contacts: { include: { contact: true } }, aliases: true } } },
    });
    return alias?.organization ?? null;
  }

  return null;
}
