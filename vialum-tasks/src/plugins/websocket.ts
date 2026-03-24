import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { JwtPayload } from '../lib/jwt-auth.js';

let io: SocketServer | null = null;

export async function initSocketIO(httpServer: HttpServer): Promise<SocketServer> {
  io = new SocketServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
    path: '/tasks/ws',
  });

  // Redis adapter for horizontal scaling (conditional)
  if (env.REDIS_URL) {
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const { default: Redis } = await import('ioredis');
      const pubClient = new Redis(env.REDIS_URL);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.IO: Redis adapter enabled');
    } catch (err) {
      console.warn('Socket.IO: Redis adapter failed, using in-memory', err);
    }
  }

  // Auth middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.accountId = payload.accountId;
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // Join account room on connect
  io.on('connection', (socket) => {
    const { accountId } = socket.data;
    socket.join(`account:${accountId}`);

    // Join specific workflow room — with tenant verification
    socket.on('workflow:subscribe', async (workflowId: string) => {
      try {
        const { getPrisma } = await import('../config/database.js');
        const prisma = getPrisma();
        const workflow = await prisma.workflow.findFirst({
          where: { id: workflowId, accountId },
          select: { id: true },
        });
        if (workflow) {
          socket.join(`workflow:${workflowId}`);
        } else {
          socket.emit('error', { message: 'Workflow not found or access denied' });
        }
      } catch {
        socket.emit('error', { message: 'Failed to verify workflow access' });
      }
    });

    socket.on('workflow:unsubscribe', (workflowId: string) => {
      socket.leave(`workflow:${workflowId}`);
    });
  });

  return io;
}

export function getIO(): SocketServer | null {
  return io;
}

// Typed broadcast helpers
export function broadcastToAccount(accountId: string, event: string, data: unknown) {
  io?.to(`account:${accountId}`).emit(event, data);
}

export function broadcastToWorkflow(workflowId: string, event: string, data: unknown) {
  io?.to(`workflow:${workflowId}`).emit(event, data);
}
