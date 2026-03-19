import { getPrisma } from '../../config/database.js';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface UpdateUserInput {
  name?: string;
  role?: string;
  availability?: string;
}

export async function list(accountId: string) {
  const prisma = getPrisma();

  return prisma.accountUser.findMany({
    where: { accountId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(accountId: string, data: CreateUserInput) {
  const prisma = getPrisma();

  // Check unique email
  const existing = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    // Check if already in this account
    const alreadyMember = await prisma.accountUser.findUnique({
      where: { accountId_userId: { accountId, userId: existing.id } },
    });

    if (alreadyMember) {
      throw { statusCode: 409, message: 'User already belongs to this account', code: 'USER_ALREADY_EXISTS' };
    }

    // Add existing user to account
    return prisma.accountUser.create({
      data: {
        accountId,
        userId: existing.id,
        role: data.role ?? 'agent',
      },
      include: { user: true },
    });
  }

  // Create new user + account membership
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
    },
  });

  return prisma.accountUser.create({
    data: {
      accountId,
      userId: user.id,
      role: data.role ?? 'agent',
    },
    include: { user: true },
  });
}

export async function update(accountId: string, userId: string, data: UpdateUserInput) {
  const prisma = getPrisma();

  const accountUser = await prisma.accountUser.findUnique({
    where: { accountId_userId: { accountId, userId } },
  });

  if (!accountUser) {
    throw { statusCode: 404, message: 'User not found in account', code: 'USER_NOT_FOUND' };
  }

  // Update user name if provided
  if (data.name !== undefined) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
    });
  }

  // Update account user role/availability if provided
  return prisma.accountUser.update({
    where: { id: accountUser.id },
    data: {
      ...(data.role !== undefined && { role: data.role }),
      ...(data.availability !== undefined && { availability: data.availability }),
    },
    include: { user: true },
  });
}

export async function remove(accountId: string, userId: string) {
  const prisma = getPrisma();

  const accountUser = await prisma.accountUser.findUnique({
    where: { accountId_userId: { accountId, userId } },
  });

  if (!accountUser) {
    throw { statusCode: 404, message: 'User not found in account', code: 'USER_NOT_FOUND' };
  }

  await prisma.accountUser.delete({
    where: { id: accountUser.id },
  });
}
