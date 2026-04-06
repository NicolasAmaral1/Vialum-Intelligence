'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { useMessagesStore } from '@/stores/messages.store';
import { getAccessToken, isTokenExpired, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '@/lib/auth/tokens';
import { initSocket, disconnectSocket, getSocket } from '@/lib/socket/client';
import { useConnectionStore } from '@/stores/connection.store';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type {
  MessageCreatedEvent,
  ConversationUpdatedEvent,
  ConversationStatusChangedEvent,
  ConversationReopenedEvent,
  TalkHitlQueuedEvent,
  SuggestionCreatedEvent,
} from '@/types/socket';
import type { Conversation } from '@/types/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, currentAccount } = useAuthStore();
  const upsertConversation = useConversationsStore((s) => s.upsertConversation);
  const addMessage = useMessagesStore((s) => s.addMessage);
  const addSuggestion = useSuggestionsStore((s) => s.addSuggestion);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!currentAccount) {
      router.replace('/account-select');
      return;
    }
    setReady(true);
  }, [isAuthenticated, currentAccount, router]);

  // Socket initialization + event handlers
  useEffect(() => {
    if (!ready || !currentAccount) return;

    const token = getAccessToken();
    if (!token) return;

    // Token refresh callback for socket reconnection
    const refreshTokenForSocket = async (): Promise<string | null> => {
      const current = getAccessToken();
      if (current && !isTokenExpired(current)) return current;
      const rt = getRefreshToken();
      if (!rt) return null;
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/chat';
        const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        return data.accessToken;
      } catch {
        return null;
      }
    };

    const socket = initSocket(token, refreshTokenForSocket);
    const accountId = currentAccount.accountId;

    // Subscribe to account room on connect and reconnect
    const onConnect = () => {
      socket.emit('subscribe:account', accountId);
    };
    socket.on('connect', onConnect);
    socket.io.on('reconnect' as any, onConnect);

    // Use getState() to avoid stale closures — store actions are stable
    const onMessageCreated = (data: MessageCreatedEvent) => {
      useMessagesStore.getState().addMessage(data.message.conversationId, data.message);
    };
    const onConversationUpdated = (data: ConversationUpdatedEvent) => {
      useConversationsStore.getState().upsertConversation({
        id: data.conversationId,
        lastActivityAt: data.lastActivityAt,
        unreadCount: data.unreadCount,
      });
    };
    const onStatusChanged = (data: ConversationStatusChangedEvent) => {
      useConversationsStore.getState().upsertConversation({
        id: data.conversationId,
        status: data.status as Conversation['status'],
      });
    };
    const onReopened = (data: ConversationReopenedEvent) => {
      useConversationsStore.getState().upsertConversation({
        id: data.conversationId,
        status: 'open',
      });
    };
    const onHitlQueued = (data: TalkHitlQueuedEvent) => {
      useSuggestionsStore.getState().addSuggestion(data.conversationId, {
        id: data.suggestionId,
        conversationId: data.conversationId,
        talkId: data.talkId,
        content: data.content,
        status: 'pending',
        autoMode: false,
        context: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId,
      });
    };
    const onSuggestionCreated = (data: SuggestionCreatedEvent) => {
      useSuggestionsStore.getState().addSuggestion(data.conversationId, {
        id: data.suggestionId,
        conversationId: data.conversationId,
        content: data.content,
        status: 'pending',
        autoMode: false,
        context: data.context,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId,
      });
    };

    socket.on('message:created', onMessageCreated);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('conversation:status_changed', onStatusChanged);
    socket.on('conversation:reopened', onReopened);
    socket.on('talk:hitl_queued', onHitlQueued);
    socket.on('suggestion:created', onSuggestionCreated);

    return () => {
      socket.off('connect', onConnect);
      socket.io.off('reconnect' as any, onConnect);
      socket.off('message:created', onMessageCreated);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('conversation:status_changed', onStatusChanged);
      socket.off('conversation:reopened', onReopened);
      socket.off('talk:hitl_queued', onHitlQueued);
      socket.off('suggestion:created', onSuggestionCreated);
      disconnectSocket();
    };
  }, [ready, currentAccount]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <DebugErrorBoundary>
      <ConnectionBanner />
      <AppShell>{children}</AppShell>
    </DebugErrorBoundary>
  );
}

function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  if (status === 'connected') return null;
  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-1.5 text-center text-xs font-medium ${
      status === 'disconnected'
        ? 'bg-red-600 text-white'
        : 'bg-yellow-500 text-black'
    }`}>
      {status === 'disconnected' ? 'Conexao perdida. Reconectando...' : 'Reconectando...'}
    </div>
  );
}

class DebugErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('=== DEBUG ERROR BOUNDARY ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20, color: 'red', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          <h2>{'Debug Error Boundary'}</h2>
          <p>{String(this.state.error.message)}</p>
          <pre>{String(this.state.error.stack ?? '')}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
