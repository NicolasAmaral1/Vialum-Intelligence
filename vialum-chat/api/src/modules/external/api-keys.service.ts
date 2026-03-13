import crypto from 'node:crypto';
import { getPrisma } from '../../config/database.js';

export async function listApiKeys(accountId: string) {
  const prisma = getPrisma();
  return prisma.accountApiKey.findMany({
    where: { accountId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      active: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(accountId: string, name: string) {
  const prisma = getPrisma();

  // Generate key: vialum_sk_<48 random bytes as base64url>
  const rawKey = crypto.randomBytes(48).toString('base64url');
  const plainKey = `vialum_sk_${rawKey}`;
  const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
  const keyPrefix = plainKey.slice(0, 16);

  const record = await prisma.accountApiKey.create({
    data: {
      accountId,
      name,
      keyHash,
      keyPrefix,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  // Return plain key ONCE — it cannot be recovered after this
  return { ...record, key: plainKey };
}

export async function deleteApiKey(accountId: string, keyId: string) {
  const prisma = getPrisma();

  const existing = await prisma.accountApiKey.findFirst({
    where: { id: keyId, accountId },
  });

  if (!existing) {
    throw { statusCode: 404, message: 'API key not found', code: 'API_KEY_NOT_FOUND' };
  }

  await prisma.accountApiKey.update({
    where: { id: keyId },
    data: { active: false },
  });

  return { id: keyId, deactivated: true };
}
