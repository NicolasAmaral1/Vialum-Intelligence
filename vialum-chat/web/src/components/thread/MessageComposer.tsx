'use client';

import { useState, useRef, useCallback } from 'react';
import { Smile, Paperclip, Mic, Send, Lock } from 'lucide-react';
import { useMessages } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { cn } from '@/lib/utils';

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

  const hasText = content.trim().length > 0;

  return (
    <div className="bg-raised border-t border-border px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 mb-2">
          <button
            onClick={() => setIsPrivate(false)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors',
              !isPrivate
                ? 'bg-surface-custom text-text-2'
                : 'text-text-4 hover:text-text-3'
            )}
          >
            Responder
          </button>
          <button
            onClick={() => setIsPrivate(true)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5',
              isPrivate
                ? 'bg-surface-custom text-text-2'
                : 'text-text-4 hover:text-text-3'
            )}
          >
            <Lock className="h-3 w-3" />
            Nota Privada
          </button>
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Left icon buttons */}
          <div className="flex items-center gap-0.5 pb-1.5">
            <button className="text-text-3 hover:bg-white/[0.05] rounded-lg p-2 transition-colors">
              <Smile className="h-[18px] w-[18px]" />
            </button>
            <button className="text-text-3 hover:bg-white/[0.05] rounded-lg p-2 transition-colors">
              <Paperclip className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={isPrivate ? 'Escreva uma nota privada...' : 'Digite sua mensagem...'}
              rows={1}
              className={cn(
                'w-full bg-surface-custom border rounded-xl px-4 py-2.5 text-[13.5px] text-text-1 focus:outline-none focus:border-primary/50 min-h-[42px] max-h-[160px] resize-none placeholder:text-text-4',
                isPrivate
                  ? 'bg-note border-warning'
                  : 'border-border'
              )}
            />
          </div>

          {/* Send / Mic button */}
          <div className="pb-1.5">
            {hasText ? (
              <button
                onClick={handleSend}
                className="bg-primary text-primary-foreground rounded-xl p-2.5 transition-colors"
              >
                <Send className="h-[18px] w-[18px]" />
              </button>
            ) : (
              <button className="text-text-3 hover:bg-white/[0.05] rounded-xl p-2.5 transition-colors">
                <Mic className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-text-4">
            <kbd className="bg-surface-custom text-text-3 px-1 py-0.5 rounded text-[9px]">/</kbd>{' '}
            respostas rápidas
          </span>
          <span className="text-[10px] text-text-4">
            <kbd className="bg-surface-custom text-text-3 px-1 py-0.5 rounded text-[9px]">Enter</kbd>{' '}
            enviar{' · '}
            <kbd className="bg-surface-custom text-text-3 px-1 py-0.5 rounded text-[9px]">Shift+Enter</kbd>{' '}
            nova linha
          </span>
        </div>
      </div>
    </div>
  );
}
