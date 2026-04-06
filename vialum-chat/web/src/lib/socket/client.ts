import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';
import { useConnectionStore } from '@/stores/connection.store';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;
let authRedirected = false;

export function initSocket(
  accessToken: string,
  onTokenRefresh?: () => Promise<string | null>,
): TypedSocket {
  if (socket) disconnectSocket();
  authRedirected = false;

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  socket = io(wsUrl, {
    path: '/chat/ws',
    auth: { token: accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  }) as TypedSocket;

  // Refresh token before each reconnection attempt (manager-level event)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mgr = socket.io as any;
  if (onTokenRefresh) {
    mgr.on('reconnect_attempt', async () => {
      const freshToken = await onTokenRefresh().catch(() => null);
      if (freshToken && socket) {
        (socket.auth as Record<string, string>).token = freshToken;
      }
    });
  }

  // Connection status tracking
  socket.on('connect', () => useConnectionStore.getState().setStatus('connected'));
  socket.on('disconnect', () => useConnectionStore.getState().setStatus('disconnected'));
  mgr.on('reconnect_attempt', () => useConnectionStore.getState().setStatus('connecting'));
  mgr.on('reconnect', () => useConnectionStore.getState().setStatus('connected'));

  // Redirect to login on permanent auth failure (debounced)
  socket.on('connect_error', (err: Error) => {
    const msg = err.message ?? '';
    if ((msg.includes('Authentication') || msg.includes('jwt') || msg.includes('Unauthorized')) && !authRedirected) {
      authRedirected = true;
      console.error('[socket] Auth failed, redirecting to login');
      disconnectSocket();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  });

  return socket;
}

export function getSocket(): TypedSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.io.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
