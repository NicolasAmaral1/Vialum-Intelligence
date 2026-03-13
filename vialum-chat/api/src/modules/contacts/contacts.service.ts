import { getPrisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';

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
    data,
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

  return contact;
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
