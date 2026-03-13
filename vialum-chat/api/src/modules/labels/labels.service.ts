import { getPrisma } from '../../config/database.js';

export interface CreateLabelInput {
  name: string;
  color?: string;
  description?: string | null;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  description?: string | null;
}

export async function create(accountId: string, data: CreateLabelInput) {
  const prisma = getPrisma();

  return prisma.label.create({
    data: {
      accountId,
      name: data.name,
      color: data.color ?? '#6366F1',
      description: data.description ?? null,
    },
  });
}

export async function findAll(accountId: string) {
  const prisma = getPrisma();

  return prisma.label.findMany({
    where: { accountId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { conversationLabels: true } },
    },
  });
}

export async function findById(accountId: string, labelId: string) {
  const prisma = getPrisma();

  const label = await prisma.label.findFirst({
    where: { id: labelId, accountId },
    include: {
      _count: { select: { conversationLabels: true } },
    },
  });

  if (!label) {
    throw { statusCode: 404, message: 'Label not found', code: 'LABEL_NOT_FOUND' };
  }

  return label;
}

export async function update(accountId: string, labelId: string, data: UpdateLabelInput) {
  const prisma = getPrisma();

  const existing = await prisma.label.findFirst({
    where: { id: labelId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Label not found', code: 'LABEL_NOT_FOUND' };
  }

  return prisma.label.update({
    where: { id: labelId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.description !== undefined && { description: data.description }),
    },
  });
}

export async function remove(accountId: string, labelId: string) {
  const prisma = getPrisma();

  const existing = await prisma.label.findFirst({
    where: { id: labelId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'Label not found', code: 'LABEL_NOT_FOUND' };
  }

  await prisma.label.delete({ where: { id: labelId } });
}
