'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMessagesStore } from '@/stores/messages.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import { conversationsApi } from '@/lib/api/conversations';
import { messagesApi } from '@/lib/api/messages';
import { aiSuggestionsApi } from '@/lib/api/ai-suggestions';
import { getSocket } from '@/lib/socket/client';
import { MessageBlockCard } from '@/components/hitl/MessageBlockCard';
import { ContactSidebar } from '@/components/thread/ContactSidebar';
import { User } from 'lucide-react';
import type { Message, AISuggestion, Contact, Label, Group } from '@/types/api';

const EMPTY_MESSAGES: Message[] = [];
const EMPTY_SUGGESTIONS: AISuggestion[] = [];

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

  // Use stable empty array reference to prevent infinite re-render loop
  const storeMessages = useMessagesStore((s) => s.byConversation[conversationId]);
  const messages = storeMessages ?? EMPTY_MESSAGES;
  const setMessages = useMessagesStore((s) => s.setMessages);
  const addMessage = useMessagesStore((s) => s.addMessage);

  const storeSuggestions = useSuggestionsStore((s) => s.byConversation[conversationId]);
  const suggestions = storeSuggestions ?? EMPTY_SUGGESTIONS;
  const setSuggestions = useSuggestionsStore((s) => s.setSuggestions);
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  const [contactData, setContactData] = useState<Contact | null>(null);
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [conversationStatus, setConversationStatus] = useState('open');
  const [conversationLabels, setConversationLabels] = useState<Label[]>([]);
  const [activeTalk, setActiveTalk] = useState<ActiveTalkInfo | null>(null);
  const [pendingSuggestionsCount, setPendingSuggestionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [composerText, setComposerText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    if (!currentAccount) return;
    try {
      const [convResult, msgResult, sugResult] = await Promise.all([
        conversationsApi.get(currentAccount.accountId, conversationId),
        messagesApi.list(currentAccount.accountId, conversationId, { limit: 30 }),
        aiSuggestionsApi.list(currentAccount.accountId, { conversationId, status: 'pending' }),
      ]);
      const conv = convResult.data as unknown as Record<string, unknown>;
      setContactData((conv?.contact as Contact) ?? null);
      setGroupData((conv?.group as Group) ?? null);
      setConversationStatus((conv?.status as string) ?? 'open');
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

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return;
    socket.emit('subscribe:conversation', conversationId);
    return () => {
      socket.emit('unsubscribe:conversation', conversationId);
    };
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = composerText.trim();
    if (!text || !currentAccount) return;
    setComposerText('');
    try {
      const result = await messagesApi.create(currentAccount.accountId, conversationId, {
        content: text,
        messageType: 'outgoing',
        contentType: 'text',
      });
      addMessage(conversationId, result.data);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const isGroup = !!groupData;
  const displayName = isGroup ? (groupData?.name || 'Grupo sem nome') : (contactData?.name ?? 'Sem nome');
  const displaySubtitle = isGroup
    ? (groupData?.groupType === 'agency' ? 'Grupo agência' : 'Grupo cliente')
    : (contactData?.phone ?? '');

  return (
    <div className="flex h-full">
      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-background">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shadow-sm">
              {isGroup ? '👥' : displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left">
              <h3 className="font-medium text-sm">{displayName}</h3>
              {displaySubtitle ? <p className="text-[11px] text-muted-foreground">{displaySubtitle}</p> : null}
            </div>
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={'p-2 rounded-lg transition-all ' + (sidebarOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}
            title="Detalhes do contato"
          >
            <User className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg) => {
            const isOut = msg.messageType === 'outgoing';
            const txt = String(msg.content ?? '');
            let time = '';
            try {
              time = new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch {
              time = '';
            }

            const senderName = isGroup && !isOut && msg.senderContact?.name
              ? msg.senderContact.name.split(' ')[0]
              : null;

            return (
              <div
                key={msg.id}
                className={'flex ' + (isOut ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={
                    'max-w-[70%] px-4 py-2.5 text-sm leading-relaxed ' +
                    (isOut
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                      : 'bg-card border border-border/50 rounded-2xl rounded-bl-md text-foreground')
                  }
                >
                  {senderName && (
                    <div className="text-[11px] font-semibold text-primary/80 mb-0.5">{senderName}</div>
                  )}
                  <span>{txt}</span>
                  {time ? (
                    <div className={
                      'text-[10px] mt-1 ' +
                      (isOut ? 'text-primary-foreground/60' : 'text-muted-foreground')
                    }>
                      {time}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* HITL Suggestions */}
        {pendingSuggestions.length > 0 && (
          <div className="border-t border-border/50 px-3 py-2 space-y-2 bg-muted/10">
            {pendingSuggestions.map((suggestion) => (
              <MessageBlockCard
                key={suggestion.id}
                suggestion={suggestion}
                conversationId={conversationId}
              />
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="border-t border-border/50 p-3 flex gap-2 bg-background">
          <input
            type="text"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-xl border border-border/50 px-4 py-2.5 text-sm bg-card focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={!composerText.trim()}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:bg-primary/90 transition-all"
          >
            Enviar
          </button>
        </div>
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
