'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { conversationsApi } from '@/lib/api/conversations';
import { messagesApi } from '@/lib/api/messages';
import { aiSuggestionsApi } from '@/lib/api/ai-suggestions';
import { getSocket } from '@/lib/socket/client';
import { ConversationHeader } from '@/components/thread/ConversationHeader';
import { MessageThread } from '@/components/thread/MessageThread';
import { MessageComposer } from '@/components/thread/MessageComposer';
import { HITLBar } from '@/components/hitl/HITLBar';
import { ContactSidebar } from '@/components/thread/ContactSidebar';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Contact, Label, Conversation } from '@/types/api';

interface ActiveTalkInfo {
  id: string;
  status: string;
  treeFlowId: string;
  treeFlow?: { name: string; slug: string; category: string | null } | null;
  talkFlow?: { currentStepId: string } | null;
}

export default function ConversationPage() {
  const params = useParams<{ conversationId: string }>();
  const conversationId = params.conversationId as string;
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const setMessages = useMessagesStore((s) => s.setMessages);
  const setSuggestions = useSuggestionsStore((s) => s.setSuggestions);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [contactData, setContactData] = useState<Contact | null>(null);
  const [conversationLabels, setConversationLabels] = useState<Label[]>([]);
  const [activeTalk, setActiveTalk] = useState<ActiveTalkInfo | null>(null);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const [convResult, msgResult, sugResult] = await Promise.all([
        conversationsApi.get(currentAccount.accountId, conversationId),
        messagesApi.list(currentAccount.accountId, conversationId, { limit: 30 }),
        aiSuggestionsApi.list(currentAccount.accountId, { conversationId, status: 'pending' }),
      ]);
      const conv = convResult.data as unknown as Record<string, unknown>;
      setConversation(convResult.data);
      setContactData((conv?.contact as Contact) ?? null);
      setConversationLabels((conv?.labels as Label[]) ?? []);
      setActiveTalk((conv?.activeTalk as ActiveTalkInfo) ?? null);
      setPendingSuggestionsCount((conv?.pendingSuggestionsCount as number) ?? 0);
      setMessages(conversationId, msgResult.data ?? []);
      setSuggestions(conversationId, sugResult.data ?? []);
    } catch (err) {
      console.error('Failed to fetch conversation data', err);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, conversationId, setMessages, setSuggestions]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Socket subscription
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return;
    socket.emit('subscribe:conversation', conversationId);
    return () => {
      socket.emit('unsubscribe:conversation', conversationId);
    };
  }, [conversationId]);

  if (loading || !conversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const conversationStatus = conversation.status ?? 'open';

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationHeader
          conversation={conversation}
          onRefresh={fetchData}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <MessageThread conversationId={conversationId} />

        <HITLBar conversationId={conversationId} />

        <MessageComposer conversationId={conversationId} />
      </div>

      {/* Contact Sidebar */}
      {sidebarOpen && contactData && (
        <ContactSidebar
          contact={contactData}
          conversationStatus={conversationStatus}
          labels={conversationLabels}
          activeTalk={activeTalk}
          pendingSuggestionsCount={pendingSuggestionsCount}
          onClose={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
