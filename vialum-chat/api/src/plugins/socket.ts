import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server as SocketIOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

async function socketPlugin(fastify: FastifyInstance) {
  const io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    path: '/chat/ws',
  });

  io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    // Subscribe to account room
    socket.on('subscribe:account', (accountId: string) => {
      socket.join(`account:${accountId}`);
      fastify.log.info(`Socket ${socket.id} joined account:${accountId}`);
    });

    // Subscribe to conversation room
    socket.on('subscribe:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('unsubscribe:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on('typing:start', (data: { conversationId: string; userId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('conversation:typing_on', {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    });

    socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
      socket.to(`conversation:${data.conversationId}`).emit('conversation:typing_off', {
        conversationId: data.conversationId,
        userId: data.userId,
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

export default fp(socketPlugin, { name: 'socket' });
