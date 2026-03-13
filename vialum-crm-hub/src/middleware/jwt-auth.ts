import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  accountId: string;
  role: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload?: JwtPayload;
  }
}

export async function jwtAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Skip auth for routes that explicitly opt out (e.g., OAuth callbacks)
  if ((request.routeOptions.config as unknown as Record<string, unknown>)?.skipAuth) return;

  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    request.jwtPayload = payload;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}
