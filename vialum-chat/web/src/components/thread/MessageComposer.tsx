'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { Send, Lock } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';

interface MessageComposerProps {
  conversationId: string;
}

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { sendMessage } = useMessages(conversationId);
  const { startTyping, stopTyping } = useTypingIndicator(conversationId);

  const handleSend = useCallback(() => {
    const text = content.trim();
    if (!text) return;
    sendMessage(text, isPrivate);
    setContent('');
    stopTyping();
    textareaRef.current?.focus();
  }, [content, isPrivate, sendMessage, stopTyping]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    startTyping();
  };

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isPrivate ? 'Escreva uma nota privada...' : 'Digite sua mensagem...'}
            className="min-h-[44px] max-h-[160px] resize-none pr-10"
            rows={1}
          />
        </div>
        <div className="flex items-center gap-1">
          <Toggle
            pressed={isPrivate}
            onPressedChange={setIsPrivate}
            size="sm"
            aria-label="Nota privada"
            className="data-[state=on]:bg-yellow-500/20 data-[state=on]:text-yellow-600"
          >
            <Lock className="h-4 w-4" />
          </Toggle>
          <Button size="icon" onClick={handleSend} disabled={!content.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
