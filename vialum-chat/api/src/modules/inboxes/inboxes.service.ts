import { getPrisma } from '../../config/database.js';

export interface CreateInboxInput {
  name: string;
  channelType?: string;
  provider: string;
  providerConfig?: Record<string, unknown>;
  workingHours?: Record<string, unknown>;
  greetingMessage?: string | null;
  outOfOfficeMessage?: string | null;
}

export interface UpdateInboxInput {
  name?: string;
  providerConfig?: Record<string, unknown>;
  workingHours?: Record<string, unknown>;
  greetingMessage?: string | null;
  outOfOfficeMessage?: string | null;
}

export async function create(accountId: string, data: CreateInboxInput) {
  const prisma = getPrisma();

  return prisma.inbox.create({
    data: {
      accountId,
      name: data.name,
      channelType: data.channelType ?? 'whatsapp',
      provider: data.provider,
      providerConfig: (data.providerConfig ?? {}) as any,
      workingHours: (data.workingHours ?? {}) as any,
      greetingMessage: data.greetingMessage ?? null,
      outOfOfficeMessage: data.outOfOfficeMessage ?? null,
    },
  });
}

export async function findAll(accountId: string) {
  const prisma = getPrisma();

  return prisma.inbox.findMany({
    where: { accountId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findById(accountId: string, inboxId: string) {
  const prisma = getPrisma();

  const inbox = await prisma.inbox.findFirst({
    where: { id: inboxId, accountId },
  });

  if (!inbox) {
    throw { statusCode: 404, message: 'Inbox not found', code: 'INBOX_NOT_FOUND' };
  }

  return inbox;
}

export async function update(accountId: string, inboxId: string, data: UpdateInboxInput) {
  const prisma = getPrisma();

  // Verify ownership
  const existing = await prisma.inbox.findFirst({
    where: { id: inboxId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Inbox not found', code: 'INBOX_NOT_FOUND' };
  }

  return prisma.inbox.update({
    where: { id: inboxId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.providerConfig !== undefined && { providerConfig: data.providerConfig as any }),
      ...(data.workingHours !== undefined && { workingHours: data.workingHours as any }),
      ...(data.greetingMessage !== undefined && { greetingMessage: data.greetingMessage }),
      ...(data.outOfOfficeMessage !== undefined && { outOfOfficeMessage: data.outOfOfficeMessage }),
    },
  });
}

export async function remove(accountId: string, inboxId: string) {
  const prisma = getPrisma();

  const existing = await prisma.inbox.findFirst({
    where: { id: inboxId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Inbox not found', code: 'INBOX_NOT_FOUND' };
  }

  await prisma.inbox.delete({
    where: { id: inboxId },
  });
}
