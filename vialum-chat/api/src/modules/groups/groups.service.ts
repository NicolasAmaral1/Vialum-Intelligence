import { getPrisma } from '../../config/database.js';
import { getGroupProvider } from '../../providers/factory.js';
import type { ProviderConfig, GroupInfoResult } from '../../providers/whatsapp.interface.js';

// ════════════════════════════════════════════════════════════
// Groups Service
// CRUD + WhatsApp group management via Evolution API
// ════════════════════════════════════════════════════════════

interface CreateGroupInput {
  inboxId: string;
  name: string;
  participants: string[]; // phone numbers
  description?: string;
  groupType?: 'client' | 'agency';
}

interface UpdateGroupInput {
  name?: string;
  description?: string;
  groupType?: 'client' | 'agency';
}

interface ListFilters {
  groupType?: string;
  inboxId?: string;
  page?: number;
  limit?: number;
}

export async function create(accountId: string, input: CreateGroupInput) {
  const prisma = getPrisma();

  // Load inbox to get provider config
  const inbox = await prisma.inbox.findFirstOrThrow({
    where: { id: input.inboxId, accountId },
  });

  const groupProvider = getGroupProvider(inbox.provider);
  if (!groupProvider) {
    throw new Error(`Provider "${inbox.provider}" does not support group management`);
  }

  const providerConfig = inbox.providerConfig as ProviderConfig;

  // Create group on WhatsApp
  const result = await groupProvider.createGroup(providerConfig, {
    name: input.name,
    participants: input.participants,
    description: input.description,
  });

  // Save group + members atomically
  return prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        accountId,
        inboxId: input.inboxId,
        jid: result.groupJid,
        name: result.name,
        description: input.description ?? null,
        groupType: input.groupType ?? 'client',
      },
    });

    // Batch: find existing contacts, create missing, then bulk-create members
    const existingContacts = await tx.contact.findMany({
      where: { accountId, phone: { in: input.participants } },
      select: { id: true, phone: true },
    });
    const existingByPhone = new Map<string, string>();
    for (const c of existingContacts) {
      if (c.phone) existingByPhone.set(c.phone, c.id);
    }

    const newPhones = input.participants.filter((p) => !existingByPhone.has(p));
    if (newPhones.length > 0) {
      await tx.contact.createMany({
        data: newPhones.map((phone) => ({ accountId, name: phone, phone })),
        skipDuplicates: true,
      });
      const created = await tx.contact.findMany({
        where: { accountId, phone: { in: newPhones } },
        select: { id: true, phone: true },
      });
      for (const c of created) {
        if (c.phone) existingByPhone.set(c.phone, c.id);
      }
    }

    await tx.groupMember.createMany({
      data: input.participants
        .filter((phone) => existingByPhone.has(phone))
        .map((phone) => ({
          groupId: group.id,
          contactId: existingByPhone.get(phone)!,
          role: 'member',
        })),
      skipDuplicates: true,
    });

    return group;
  });
}

export async function findAll(accountId: string, filters: ListFilters) {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { accountId };
  if (filters.groupType) where.groupType = filters.groupType;
  if (filters.inboxId) where.inboxId = filters.inboxId;

  const [groups, total] = await Promise.all([
    prisma.group.findMany({
      where,
      include: {
        inbox: { select: { id: true, name: true, provider: true } },
        _count: { select: { members: true, conversations: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.group.count({ where }),
  ]);

  return { data: groups, meta: { total, page, limit } };
}

export async function findById(accountId: string, groupId: string) {
  const prisma = getPrisma();

  return prisma.group.findFirstOrThrow({
    where: { id: groupId, accountId },
    include: {
      inbox: { select: { id: true, name: true, provider: true } },
      members: {
        include: {
          contact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
}

export async function update(accountId: string, groupId: string, input: UpdateGroupInput) {
  const prisma = getPrisma();

  const group = await prisma.group.findFirstOrThrow({
    where: { id: groupId, accountId },
    include: { inbox: true },
  });

  // Update on WhatsApp if name or description changed
  const groupProvider = getGroupProvider(group.inbox.provider);
  const providerConfig = group.inbox.providerConfig as ProviderConfig;

  if (groupProvider && input.name && input.name !== group.name) {
    await groupProvider.updateGroupSubject(providerConfig, group.jid, input.name);
  }

  if (groupProvider && input.description !== undefined && input.description !== group.description) {
    await groupProvider.updateGroupDescription(providerConfig, group.jid, input.description ?? '');
  }

  // Update in DB
  return prisma.group.update({
    where: { id: groupId },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.groupType && { groupType: input.groupType }),
    },
  });
}

export async function syncFromWhatsApp(accountId: string, groupId: string): Promise<GroupInfoResult> {
  const prisma = getPrisma();

  const group = await prisma.group.findFirstOrThrow({
    where: { id: groupId, accountId },
    include: { inbox: true },
  });

  const groupProvider = getGroupProvider(group.inbox.provider);
  if (!groupProvider) {
    throw new Error(`Provider "${group.inbox.provider}" does not support group management`);
  }

  const providerConfig = group.inbox.providerConfig as ProviderConfig;
  const info = await groupProvider.getGroupInfo(providerConfig, group.jid);

  // All DB updates in a single transaction
  await prisma.$transaction(async (tx) => {
    // Update group info
    await tx.group.update({
      where: { id: groupId },
      data: {
        name: info.name,
        description: info.description,
        profilePicUrl: info.profilePicUrl,
      },
    });

    // Batch: find existing contacts, create missing ones
    const participantPhones = info.participants.map((p) => p.phone);
    const existingContacts = await tx.contact.findMany({
      where: { accountId, phone: { in: participantPhones } },
      select: { id: true, phone: true },
    });
    const existingByPhone = new Map<string, string>();
    for (const c of existingContacts) {
      if (c.phone) existingByPhone.set(c.phone, c.id);
    }

    const newPhones = participantPhones.filter((p) => !existingByPhone.has(p));
    if (newPhones.length > 0) {
      await tx.contact.createMany({
        data: newPhones.map((phone) => ({ accountId, name: phone, phone })),
        skipDuplicates: true,
      });
      const created = await tx.contact.findMany({
        where: { accountId, phone: { in: newPhones } },
        select: { id: true, phone: true },
      });
      for (const c of created) {
        if (c.phone) existingByPhone.set(c.phone, c.id);
      }
    }

    // Build role map for upserts
    const roleByPhone = new Map(info.participants.map((p) => [p.phone, p.role]));

    // Upsert members in tx
    for (const [phone, contactId] of existingByPhone) {
      const role = roleByPhone.get(phone) ?? 'member';
      await tx.groupMember.upsert({
        where: { groupId_contactId: { groupId, contactId } },
        create: { groupId, contactId, role },
        update: { role },
      });
    }

    // Remove members no longer in the group (batch delete)
    const currentContactIds = new Set(existingByPhone.values());
    await tx.groupMember.deleteMany({
      where: {
        groupId,
        contactId: { notIn: [...currentContactIds] },
      },
    });
  });

  return info;
}

export async function addParticipants(accountId: string, groupId: string, phones: string[]) {
  const prisma = getPrisma();

  const group = await prisma.group.findFirstOrThrow({
    where: { id: groupId, accountId },
    include: { inbox: true },
  });

  const groupProvider = getGroupProvider(group.inbox.provider);
  if (!groupProvider) {
    throw new Error(`Provider "${group.inbox.provider}" does not support group management`);
  }

  const providerConfig = group.inbox.providerConfig as ProviderConfig;

  // Add on WhatsApp first
  await groupProvider.updateParticipants(providerConfig, {
    groupJid: group.jid,
    participants: phones,
    action: 'add',
  });

  // DB operations in transaction
  return prisma.$transaction(async (tx) => {
    // Batch: find existing contacts, create missing
    const existingContacts = await tx.contact.findMany({
      where: { accountId, phone: { in: phones } },
      select: { id: true, phone: true },
    });
    const existingByPhone = new Map<string, string>();
    for (const c of existingContacts) {
      if (c.phone) existingByPhone.set(c.phone, c.id);
    }

    const newPhones = phones.filter((p) => !existingByPhone.has(p));
    if (newPhones.length > 0) {
      await tx.contact.createMany({
        data: newPhones.map((phone) => ({ accountId, name: phone, phone })),
        skipDuplicates: true,
      });
      const created = await tx.contact.findMany({
        where: { accountId, phone: { in: newPhones } },
        select: { id: true, phone: true },
      });
      for (const c of created) {
        if (c.phone) existingByPhone.set(c.phone, c.id);
      }
    }

    // Upsert members + collect results
    const added = [];
    for (const phone of phones) {
      const contactId = existingByPhone.get(phone);
      if (!contactId) continue;

      const member = await tx.groupMember.upsert({
        where: { groupId_contactId: { groupId, contactId } },
        create: { groupId, contactId, role: 'member' },
        update: {},
      });
      added.push({ memberId: member.id, contactId, phone });
    }

    return added;
  });
}

export async function removeParticipant(accountId: string, groupId: string, contactId: string) {
  const prisma = getPrisma();

  const group = await prisma.group.findFirstOrThrow({
    where: { id: groupId, accountId },
    include: { inbox: true },
  });

  const contact = await prisma.contact.findFirstOrThrow({
    where: { id: contactId, accountId },
  });

  const groupProvider = getGroupProvider(group.inbox.provider);
  if (groupProvider && contact.phone) {
    const providerConfig = group.inbox.providerConfig as ProviderConfig;
    await groupProvider.updateParticipants(providerConfig, {
      groupJid: group.jid,
      participants: [contact.phone],
      action: 'remove',
    });
  }

  await prisma.groupMember.delete({
    where: { groupId_contactId: { groupId, contactId } },
  });
}

export async function listConversations(accountId: string, groupId: string) {
  const prisma = getPrisma();

  return prisma.conversation.findMany({
    where: { accountId, groupId },
    include: {
      contact: { select: { id: true, name: true, phone: true } },
    },
    orderBy: { lastActivityAt: 'desc' },
  });
}
