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

function validateProviderConfig(provider: string, config: Record<string, unknown>) {
  if (provider === 'evolution_api') {
    const baseUrl = config.base_url ?? config.baseUrl;
    const apiKey = config.api_key ?? config.apiKey;
    const instanceName = config.instance_name ?? config.instanceName;
    const missing: string[] = [];
    if (!baseUrl) missing.push('base_url');
    if (!apiKey) missing.push('api_key');
    if (!instanceName) missing.push('instance_name');
    if (missing.length > 0) {
      throw { statusCode: 400, message: `Missing required provider config for evolution_api: ${missing.join(', ')}`, code: 'INVALID_PROVIDER_CONFIG' };
    }
  } else if (provider === 'cloud_api') {
    const phoneNumberId = config.phone_number_id ?? config.phoneNumberId;
    const accessToken = config.access_token ?? config.accessToken;
    const missing: string[] = [];
    if (!phoneNumberId) missing.push('phone_number_id');
    if (!accessToken) missing.push('access_token');
    if (missing.length > 0) {
      throw { statusCode: 400, message: `Missing required provider config for cloud_api: ${missing.join(', ')}`, code: 'INVALID_PROVIDER_CONFIG' };
    }
  }
}

export async function create(accountId: string, data: CreateInboxInput) {
  const prisma = getPrisma();

  if (data.providerConfig) {
    validateProviderConfig(data.provider, data.providerConfig);
  }

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

export async function getMyInboxIds(accountId: string, userId: string): Promise<string[]> {
  const prisma = getPrisma();

  const accountUser = await prisma.accountUser.findFirst({
    where: { accountId, userId },
    select: {
      inboxAccess: { select: { inboxId: true } },
    },
  });

  return accountUser?.inboxAccess?.map((ia) => ia.inboxId) ?? [];
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
