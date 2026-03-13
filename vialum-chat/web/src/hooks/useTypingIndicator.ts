'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { getSocket } from '@/lib/socket/client';
import { useAuthStore } from '@/stores/auth.store';

export function useTypingIndicator(conversationId: string | null) {
  const userId = useAuthStore((s) => s.user?.id);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !conversationId) return;

    const onTypingOn = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== conversationId || data.userId === userId) return;
      setTypingUsers((prev) => (prev.includes(data.userId) ? prev : [...prev, data.userId]));
    };

    const onTypingOff = (data: { conversationId: string; userId: string }) => {
      if (data.conversationId !== conversationId) return;
      setTypingUsers((prev) => prev.filter((id) => id !== data.userId));
    };

    socket.on('conversation:typing_on', onTypingOn);
    socket.on('conversation:typing_off', onTypingOff);

    return () => {
      socket.off('conversation:typing_on', onTypingOn);
      socket.off('conversation:typing_off', onTypingOff);
      setTypingUsers([]);
    };
  }, [conversationId, userId]);

  const startTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !conversationId || !userId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing:start', { conversationId, userId });
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing:stop', { conversationId, userId });
    }, 3000);
  }, [conversationId, userId]);

  const stopTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket || !conversationId || !userId || !isTypingRef.current) return;

    isTypingRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    socket.emit('typing:stop', { conversationId, userId });
  }, [conversationId, userId]);

  return { typingUsers, startTyping, stopTyping };
}
