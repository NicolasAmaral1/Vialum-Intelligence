'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { DateSeparator } from './DateSeparator';
import { TypingBubble } from './TypingBubble';
import { ScrollToBottom } from './ScrollToBottom';
import { SkeletonMessages } from './SkeletonMessages';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Message } from '@/types/api';

interface MessageThreadProps {
  conversationId: string;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Hoje';
  if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function isSameGroup(prev: Message | null, curr: Message): boolean {
  if (!prev) return false;
  if (prev.messageType !== curr.messageType) return false;
  if (prev.messageType === 'activity' || curr.messageType === 'activity') return false;
  if (prev.private !== curr.private) return false;
  // Same sender
  if (prev.senderType !== curr.senderType) return false;
  if (prev.senderContactId !== curr.senderContactId) return false;
  return true;
}

function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const { messages, loading, hasMore, loadMore } = useMessages(conversationId);
  const { typingUsers } = useTypingIndicator(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const prevLengthRef = useRef(0);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const container = containerRef.current;
      if (!container) return;
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 200;
      if (isNearBottom || messages.length - prevLengthRef.current === 1) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (container.scrollTop < 100 && hasMore && !loading) {
      loadMore();
    }

    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distFromBottom > 300);
  }, [hasMore, loading, loadMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isTyping = typingUsers.length > 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-5 py-4"
        style={{
          background: `radial-gradient(ellipse at 15% 50%, rgba(159,236,20,0.02) 0%, transparent 60%), radial-gradient(ellipse at 85% 30%, rgba(129,140,248,0.015) 0%, transparent 50%)`,
        }}
      >
        {/* Initial loading skeleton */}
        {loading && messages.length === 0 && <SkeletonMessages />}

        {/* Load more spinner */}
        {loading && hasMore && messages.length > 0 && (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-0">
          {messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const isFirst = !isSameGroup(prev, msg);

            // Date separator
            const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);

            return (
              <div key={msg._tempId || msg.id}>
                {showDate && (
                  <DateSeparator date={formatDateLabel(msg.createdAt)} />
                )}
                <MessageBubble message={msg} isFirst={isFirst} />
              </div>
            );
          })}

          {/* Typing indicator */}
          {isTyping && (
            <div className="mt-3 flex items-end gap-2">
              <ContactAvatar name="..." size={28} />
              <TypingBubble />
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showScrollDown && (
        <ScrollToBottom onClick={scrollToBottom} />
      )}
    </div>
  );
}
