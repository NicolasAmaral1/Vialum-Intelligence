'use client';

import { useRef, useEffect, useCallback } from 'react';
import { MessageBubble } from './MessageBubble';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useMessages } from '@/hooks/useMessages';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import { useState } from 'react';

interface MessageThreadProps {
  conversationId: string;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const { messages, loading, hasMore, loadMore } = useMessages(conversationId);
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

    // Load more when near top
    if (container.scrollTop < 100 && hasMore && !loading) {
      loadMore();
    }

    // Show/hide scroll-down button
    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollDown(distFromBottom > 300);
  }, [hasMore, loading, loadMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-4"
      >
        {loading && hasMore && (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg._tempId || msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
      {showScrollDown && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
