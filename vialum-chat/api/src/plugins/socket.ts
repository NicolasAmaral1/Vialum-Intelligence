import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';
import type { JwtPayload } from './auth.js';
import { getEnv } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

async function socketPlugin(fastify: FastifyInstance) {
  const env = getEnv();
  const corsOrigin = env.CORS_ORIGIN.includes(',') ? env.CORS_ORIGIN.split(',').map((s) => s.trim()) : env.CORS_ORIGIN;
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    path: '/chat/ws',
  });

  // ── JWT Authentication middleware ──
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT using Fastify's jwt instance
      const decoded = fastify.jwt.verify<JwtPayload>(token);
      socket.data.jwtPayload = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const payload = socket.data.jwtPayload as JwtPayload;
    fastify.log.info(`Socket connected: ${socket.id} (user: ${payload.userId}, account: ${payload.accountId})`);

    // Subscribe to account room — only allow the user's own account
    socket.on('subscribe:account', (accountId: string) => {
      if (accountId !== payload.accountId) {
        fastify.log.warn(`Socket ${socket.id} tried to subscribe to unauthorized account: ${accountId}`);
        return;
      }
      socket.join(`account:${accountId}`);
      fastify.log.info(`Socket ${socket.id} joined account:${accountId}`);
    });

    // Subscribe to conversation room — verify account + inbox access (RLS)
    socket.on('subscribe:conversation', async (conversationId: string) => {
      try {
        const { getPrisma } = await import('../config/database.js');
        const { getAccessibleInboxIds } = await import('../modules/inboxes/inbox-access.service.js');
        const prisma = getPrisma();

        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, accountId: payload.accountId },
          select: { id: true, inboxId: true },
        });

        if (!conversation) {
          fastify.log.warn(`Socket ${socket.id} tried to subscribe to unauthorized conversation: ${conversationId}`);
          return;
        }

        // RLS: verify user has access to this conversation's inbox
        const accessibleInboxIds = await getAccessibleInboxIds(payload.accountId, payload.userId);
        if (accessibleInboxIds !== null && !accessibleInboxIds.includes(conversation.inboxId)) {
          fastify.log.warn(`Socket ${socket.id} tried to subscribe to conversation in restricted inbox: ${conversationId}`);
          return;
        }

        socket.join(`conversation:${conversationId}`);
      } catch (err) {
        fastify.log.error(`Error verifying conversation subscription: ${err}`);
      }
    });

    socket.on('unsubscribe:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators — use userId from JWT, not from payload
    socket.on('typing:start', (data: { conversationId: string; userId?: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('conversation:typing_on', {
        conversationId: data.conversationId,
        userId: payload.userId, // Always use authenticated userId
      });
    });

    socket.on('typing:stop', (data: { conversationId: string; userId?: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('conversation:typing_off', {
        conversationId: data.conversationId,
        userId: payload.userId, // Always use authenticated userId
      });
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', async () => {
    io.close();
  });
}

export default fp(socketPlugin, {
  name: 'socket',
  dependencies: ['auth'], // Ensure auth plugin is loaded first for jwt instance
});
