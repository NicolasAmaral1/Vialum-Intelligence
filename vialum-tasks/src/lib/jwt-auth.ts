import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload { userId: string; accountId: string; role: string; }

declare module 'fastify' {
  interface FastifyRequest { jwtPayload?: JwtPayload; }
}

export async function jwtAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
  }
  try {
    request.jwtPayload = jwt.verify(authHeader.slice(7), env.JWT_SECRET) as JwtPayload;
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' });
  }
}
