'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useConversationsStore } from '@/stores/conversations.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { useMessagesStore } from '@/stores/messages.store';
import { getAccessToken } from '@/lib/auth/tokens';
import { initSocket, disconnectSocket } from '@/lib/socket/client';
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

    const socket = initSocket(token);

    socket.on('connect', () => {
      socket.emit('subscribe:account', currentAccount.accountId);
    });

    socket.on('message:created', (data: MessageCreatedEvent) => {
      addMessage(data.message.conversationId, data.message);
    });

    socket.on('conversation:updated', (data: ConversationUpdatedEvent) => {
      upsertConversation({
        id: data.conversationId,
        lastActivityAt: data.lastActivityAt,
        unreadCount: data.unreadCount,
      });
    });

    socket.on('conversation:status_changed', (data: ConversationStatusChangedEvent) => {
      upsertConversation({
        id: data.conversationId,
        status: data.status as Conversation['status'],
      });
    });

    socket.on('conversation:reopened', (data: ConversationReopenedEvent) => {
      upsertConversation({
        id: data.conversationId,
        status: 'open',
      });
    });

    socket.on('talk:hitl_queued', (data: TalkHitlQueuedEvent) => {
      addSuggestion(data.conversationId, {
        id: data.suggestionId,
        conversationId: data.conversationId,
        talkId: data.talkId,
        content: data.content,
        status: 'pending',
        autoMode: false,
        context: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: currentAccount.accountId,
      });
    });

    socket.on('suggestion:created', (data: SuggestionCreatedEvent) => {
      addSuggestion(data.conversationId, {
        id: data.suggestionId,
        conversationId: data.conversationId,
        content: data.content,
        status: 'pending',
        autoMode: false,
        context: data.context,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountId: currentAccount.accountId,
      });
    });

    return () => {
      disconnectSocket();
    };
  }, [ready, currentAccount, addMessage, upsertConversation, addSuggestion]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <DebugErrorBoundary>
      <AppShell>{children}</AppShell>
    </DebugErrorBoundary>
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
