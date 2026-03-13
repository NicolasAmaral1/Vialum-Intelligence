import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function initSocket(accessToken: string): TypedSocket {
  if (socket) socket.disconnect();

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  socket = io(wsUrl, {
    path: '/chat/ws',
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  }) as TypedSocket;

  return socket;
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
