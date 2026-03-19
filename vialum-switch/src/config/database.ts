import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'] });
  }
  return prisma;
}
