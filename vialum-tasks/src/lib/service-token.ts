import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function getServiceToken(accountId: string): string {
  return jwt.sign(
    { userId: 'tasks-service', accountId, role: 'service' },
    env.JWT_SECRET,
    { expiresIn: '5m' }
  );
}
