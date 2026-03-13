import { getPrisma } from '../../config/database.js';
import { getEnv } from '../../config/env.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  accounts: Array<{
    accountId: string;
    accountName: string;
    role: string;
  }>;
  tokens: TokenPair;
}

function generateAccessToken(userId: string, accountId: string, role: string): string {
  const env = getEnv();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId, accountId, role, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 }),
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', env.JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function generateRefreshToken(userId: string): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return { token, hash, expiresAt };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      accountUsers: {
        include: {
          account: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!user) {
    throw { statusCode: 401, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw { statusCode: 401, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' };
  }

  if (user.accountUsers.length === 0) {
    throw { statusCode: 403, message: 'User has no associated accounts', code: 'NO_ACCOUNTS' };
  }

  // Default to first account
  const primaryAccountUser = user.accountUsers[0];
  const accessToken = generateAccessToken(user.id, primaryAccountUser.accountId, primaryAccountUser.role);

  // Generate and store refresh token
  const refresh = generateRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    accounts: user.accountUsers.map((au) => ({
      accountId: au.account.id,
      accountName: au.account.name,
      role: au.role,
    })),
    tokens: {
      accessToken,
      refreshToken: refresh.token,
    },
  };
}

export async function refresh(refreshTokenValue: string): Promise<TokenPair> {
  const prisma = getPrisma();

  const hash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: {
      user: {
        include: {
          accountUsers: { take: 1 },
        },
      },
    },
  });

  if (!storedToken || storedToken.revoked || storedToken.expiresAt < new Date()) {
    // Revoke all tokens for this family if token was already used (rotation detection)
    if (storedToken && storedToken.revoked) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { revoked: true },
      });
    }
    throw { statusCode: 401, message: 'Invalid or expired refresh token', code: 'INVALID_REFRESH_TOKEN' };
  }

  // Revoke old token
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revoked: true },
  });

  const accountUser = storedToken.user.accountUsers[0];
  if (!accountUser) {
    throw { statusCode: 403, message: 'User has no associated accounts', code: 'NO_ACCOUNTS' };
  }

  const accessToken = generateAccessToken(storedToken.userId, accountUser.accountId, accountUser.role);

  // Issue new refresh token (rotation)
  const newRefresh = generateRefreshToken(storedToken.userId);
  await prisma.refreshToken.create({
    data: {
      userId: storedToken.userId,
      tokenHash: newRefresh.hash,
      expiresAt: newRefresh.expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken: newRefresh.token,
  };
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const prisma = getPrisma();
  const hash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash },
    data: { revoked: true },
  });
}

export async function me(userId: string) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      createdAt: true,
      accountUsers: {
        select: {
          accountId: true,
          role: true,
          availability: true,
          account: {
            select: { id: true, name: true, slug: true, plan: true },
          },
        },
      },
    },
  });

  if (!user) {
    throw { statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
  }

  return user;
}
