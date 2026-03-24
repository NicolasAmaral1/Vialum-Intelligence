import { getPrisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import { Prisma } from '@prisma/client';
import { getDisplayName, formatPhoneBR } from '../../lib/contact-utils.js';

export interface CreateContactInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  customAttributes?: Record<string, unknown>;
  funnelStage?: string | null;
  notes?: string | null;
}

export interface UpdateContactInput {
  name?: string;
  customName?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  customAttributes?: Record<string, unknown>;
  funnelStage?: string | null;
  notes?: string | null;
}

export interface ContactFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export async function create(accountId: string, data: CreateContactInput) {
  const prisma = getPrisma();

  return prisma.contact.create({
    data: {
      accountId,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      avatarUrl: data.avatarUrl ?? null,
      customAttributes: (data.customAttributes ?? {}) as any,
      funnelStage: data.funnelStage ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function findAll(accountId: string, filters: ContactFilters) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 25, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.ContactWhereInput = {
    accountId,
    deletedAt: null,
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    data: data.map(enrichContact),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function findById(accountId: string, contactId: string) {
  const prisma = getPrisma();

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId, deletedAt: null },
    include: {
      contactInboxes: {
        include: { inbox: { select: { id: true, name: true, provider: true } } },
      },
    },
  });

  if (!contact) {
    throw { statusCode: 404, message: 'Contact not found', code: 'CONTACT_NOT_FOUND' };
  }

  return enrichContact(contact);
}

export async function update(accountId: string, contactId: string, data: UpdateContactInput) {
  const prisma = getPrisma();

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, accountId, deletedAt: null },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Contact not found', code: 'CONTACT_NOT_FOUND' };
  }

  return prisma.contact.update({
    where: { id: contactId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.customName !== undefined && { customName: data.customName }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.customAttributes !== undefined && { customAttributes: data.customAttributes as any }),
      ...(data.funnelStage !== undefined && { funnelStage: data.funnelStage }),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
  });
}

export async function softDelete(accountId: string, contactId: string) {
  const prisma = getPrisma();

  const existing = await prisma.contact.findFirst({
    where: { id: contactId, accountId, deletedAt: null },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Contact not found', code: 'CONTACT_NOT_FOUND' };
  }

  return prisma.contact.update({
    where: { id: contactId },
    data: { deletedAt: new Date() },
  });
}

export async function updateChannel(
  accountId: string,
  contactId: string,
  data: { inboxId: string; activeConversationId?: string | null; linkedGroupId?: string | null },
) {
  const prisma = getPrisma();

  // Verify contact belongs to account
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, accountId, deletedAt: null },
  });
  if (!contact) {
    throw { statusCode: 404, message: 'Contact not found', code: 'CONTACT_NOT_FOUND' };
  }

  // Find ContactInbox
  const contactInbox = await prisma.contactInbox.findFirst({
    where: { contactId, inboxId: data.inboxId },
  });
  if (!contactInbox) {
    throw { statusCode: 404, message: 'ContactInbox not found', code: 'CONTACT_INBOX_NOT_FOUND' };
  }

  // Validate activeConversationId belongs to same account + inbox
  if (data.activeConversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { id: data.activeConversationId, accountId, inboxId: data.inboxId, deletedAt: null },
    });
    if (!conv) throw { statusCode: 400, message: 'Invalid activeConversationId', code: 'INVALID_CONVERSATION' };
  }

  // Validate linkedGroupId belongs to same account + inbox
  if (data.linkedGroupId) {
    const group = await prisma.group.findFirst({
      where: { id: data.linkedGroupId, accountId, inboxId: data.inboxId },
    });
    if (!group) throw { statusCode: 400, message: 'Invalid linkedGroupId', code: 'INVALID_GROUP' };
  }

  const result = await prisma.contactInbox.update({
    where: { id: contactInbox.id },
    data: {
      ...(data.activeConversationId !== undefined && { activeConversationId: data.activeConversationId }),
      ...(data.linkedGroupId !== undefined && { linkedGroupId: data.linkedGroupId }),
    },
  });

  // Sync group mapping to Hub (fire-and-forget)
  if (data.linkedGroupId && contact.hubContactId) {
    const group = await prisma.group.findUnique({
      where: { id: data.linkedGroupId },
      select: { jid: true, name: true, groupType: true },
    });
    if (group) {
      const env = getEnv();
      const hubUrl = env.HUB_URL ?? env.CRM_HUB_URL;
      if (hubUrl) {
        import('node:crypto').then(({ createHmac }) => {
          const secret = env.MEDIA_JWT_SECRET ?? '';
          const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
          const now = Math.floor(Date.now() / 1000);
          const payload = Buffer.from(JSON.stringify({ userId: 'chat-service', accountId, role: 'service', iat: now, exp: now + 300 })).toString('base64url');
          const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
          const token = `${header}.${payload}.${sig}`;

          fetch(`${hubUrl}/api/v1/contacts/${contact.hubContactId}/group-mapping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ groupJid: group.jid, groupName: group.name, groupType: group.groupType }),
          }).catch((err) => console.error('[channel] Hub group-mapping failed:', err.message));
        });
      }
    }
  }

  return result;
}

// Enrich contact with displayName and formattedPhone
function enrichContact<T extends { name: string; customName?: string | null; crmName?: string | null; phone?: string | null }>(contact: T): T & { displayName: string; formattedPhone: string } {
  return {
    ...contact,
    displayName: getDisplayName(contact),
    formattedPhone: formatPhoneBR(contact.phone),
  };
}
