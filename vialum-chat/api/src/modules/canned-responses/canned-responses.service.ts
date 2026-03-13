import { getPrisma } from '../../config/database.js';

export interface CreateCannedResponseInput {
  shortCode: string;
  content: string;
}

export interface UpdateCannedResponseInput {
  shortCode?: string;
  content?: string;
}

export async function create(accountId: string, data: CreateCannedResponseInput) {
  const prisma = getPrisma();

  return prisma.cannedResponse.create({
    data: {
      accountId,
      shortCode: data.shortCode,
      content: data.content,
    },
  });
}

export async function findAll(accountId: string, search?: string) {
  const prisma = getPrisma();

  return prisma.cannedResponse.findMany({
    where: {
      accountId,
      ...(search && {
        OR: [
          { shortCode: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    },
    orderBy: { shortCode: 'asc' },
  });
}

export async function findById(accountId: string, id: string) {
  const prisma = getPrisma();

  const cannedResponse = await prisma.cannedResponse.findFirst({
    where: { id, accountId },
  });

  if (!cannedResponse) {
    throw { statusCode: 404, message: 'Canned response not found', code: 'CANNED_RESPONSE_NOT_FOUND' };
  }

  return cannedResponse;
}

export async function findByShortCode(accountId: string, shortCode: string) {
  const prisma = getPrisma();

  const cannedResponse = await prisma.cannedResponse.findFirst({
    where: { accountId, shortCode },
  });

  if (!cannedResponse) {
    throw { statusCode: 404, message: 'Canned response not found', code: 'CANNED_RESPONSE_NOT_FOUND' };
  }

  return cannedResponse;
}

export async function update(accountId: string, id: string, data: UpdateCannedResponseInput) {
  const prisma = getPrisma();

  const existing = await prisma.cannedResponse.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Canned response not found', code: 'CANNED_RESPONSE_NOT_FOUND' };
  }

  return prisma.cannedResponse.update({
    where: { id },
    data: {
      ...(data.shortCode !== undefined && { shortCode: data.shortCode }),
      ...(data.content !== undefined && { content: data.content }),
    },
  });
}

export async function remove(accountId: string, id: string) {
  const prisma = getPrisma();

  const existing = await prisma.cannedResponse.findFirst({
    where: { id, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Canned response not found', code: 'CANNED_RESPONSE_NOT_FOUND' };
  }

  await prisma.cannedResponse.delete({ where: { id } });
}
