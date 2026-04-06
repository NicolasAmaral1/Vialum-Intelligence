'use client';

import { cn } from '@/lib/utils';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { ReadReceipts } from './ReadReceipts';
import { Lock, Image, Mic, Video, FileText, MapPin, Sticker, Download, Loader2, Play, CornerUpRight } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { mediaApi } from '@/lib/api/media';
import type { Message } from '@/types/api';

interface MessageBubbleProps {
  message: Message;
  isFirst?: boolean;
}

const SENDER_COLORS = [
  '#F87171', '#FB923C', '#FBBF24', '#34D399',
  '#22D3EE', '#818CF8', '#C084FC', '#F472B6',
  '#A3E635', '#2DD4BF', '#60A5FA', '#E879F9',
];

function senderColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SENDER_COLORS[Math.abs(h) % SENDER_COLORS.length];
}

export function MessageBubble({ message, isFirst = true }: MessageBubbleProps) {
  const isOutgoing = message.messageType === 'outgoing';
  const isActivity = message.messageType === 'activity';
  const isPrivate = message.private;

  if (isActivity) {
    return (
      <div className="flex justify-center py-3">
        <span className="px-4 py-1.5 rounded-full text-[11px] font-medium bg-surface-custom text-text-3">
          {message.content}
        </span>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className={cn('flex justify-end', isFirst ? 'mt-3' : 'mt-0.5')}>
        <div className="max-w-[65%] px-4 py-2.5 rounded-xl text-[13.5px] leading-relaxed bg-note border-l-[3px] border-warning">
          <div className="flex items-center gap-1.5 mb-1">
            <Lock className="w-3 h-3 text-warning" />
            <span className="text-[10px] font-semibold text-warning">
              Nota privada{message.senderContact?.name ? ` · ${message.senderContact.name}` : ''}
            </span>
          </div>
          <span className="text-note-text">{message.content}</span>
          <div className="flex items-center justify-end gap-0.5 mt-1">
            <RelativeTime date={message.createdAt} className="text-[10px] text-text-4" />
          </div>
        </div>
      </div>
    );
  }

  const senderName = message.senderContact?.name || '';

  const hasMedia = message.contentType !== 'text' && message.contentType !== 'location' && message.contentType !== 'sticker';
  const displayContent = hasMedia ? null : (message.content || null);
  const caption = hasMedia ? (message.content || null) : null;

  return (
    <div
      className={cn(
        'flex',
        isOutgoing ? 'justify-end' : 'justify-start',
        isFirst ? 'mt-3' : 'mt-[3px]'
      )}
    >
      {/* Avatar for incoming first message */}
      {!isOutgoing && isFirst && (
        <ContactAvatar name={senderName || 'C'} size={28} />
      )}
      {!isOutgoing && !isFirst && <div className="w-7 shrink-0" />}

      <div
        className={cn(
          'max-w-[65%] px-3.5 py-2 text-[13.5px] leading-relaxed border',
          !isOutgoing && 'ml-2',
          isOutgoing
            ? 'bg-bubble-out border-bubble-out-border'
            : 'bg-bubble-in border-bubble-in-border',
          message._optimistic && 'opacity-70',
          // Border radius with tail
          isOutgoing
            ? isFirst ? 'rounded-[14px] rounded-br-[4px]' : 'rounded-[14px]'
            : isFirst ? 'rounded-[14px] rounded-bl-[4px]' : 'rounded-[14px]'
        )}
      >
        {/* Sender name for incoming first message */}
        {!isOutgoing && isFirst && senderName && (
          <div
            className="text-[11.5px] font-semibold mb-0.5"
            style={{ color: senderColor(senderName) }}
          >
            {senderName}
          </div>
        )}

        {/* Forwarded label */}
        {!!(message.contentAttributes as Record<string, unknown>)?.isForwarded && (
          <div className="flex items-center gap-1 text-[10.5px] text-text-4 italic mb-1">
            <CornerUpRight className="w-3 h-3" />
            <span>
              {(message.contentAttributes as Record<string, unknown>)?.isFrequentlyForwarded
                ? 'Encaminhada com frequencia'
                : 'Encaminhada'}
            </span>
          </div>
        )}

        {hasMedia && <MediaContent message={message} />}

        {(displayContent || caption) && (
          <span className={cn('text-text-1 whitespace-pre-wrap break-words', hasMedia && 'block mt-1')}>
            {displayContent || caption}
          </span>
        )}

        <div className="flex items-center justify-end gap-0.5 mt-0.5">
          <RelativeTime date={message.createdAt} className="text-[10px] text-text-4" />
          {isOutgoing && <ReadReceipts status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function MediaContent({ message }: { message: Message }) {
  const currentAccount = useAuthStore((s) => s.currentAccount);
  const attrs = (message.contentAttributes ?? {}) as Record<string, unknown>;
  const hasMediaFile = !!attrs.mediaFileId;
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchMediaUrl = useCallback(async () => {
    if (!currentAccount || !hasMediaFile || loading) return;
    setLoading(true);
    setError(false);
    try {
      const result = await mediaApi.getUrl(currentAccount.accountId, message.conversationId, message.id);
      setMediaUrl(result.data.url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [currentAccount, message.id, message.conversationId, hasMediaFile, loading]);

  const contentType = message.contentType;
  const duration = attrs.seconds
    ? `${Math.floor(Number(attrs.seconds) / 60)}:${String(Math.floor(Number(attrs.seconds) % 60)).padStart(2, '0')}`
    : null;

  // Image — show inline preview
  if (contentType === 'image') {
    if (mediaUrl) {
      return <img src={mediaUrl} alt="Imagem" className="rounded-lg max-w-full max-h-[300px] cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')} />;
    }
    return (
      <button onClick={fetchMediaUrl} disabled={loading} className="flex items-center gap-2 text-text-3 text-[12px] hover:text-text-1 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
        <span>{error ? 'Erro ao carregar' : hasMediaFile ? 'Carregar imagem' : 'Imagem'}</span>
      </button>
    );
  }

  // Audio — inline player
  if (contentType === 'audio') {
    if (mediaUrl) {
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <audio controls src={mediaUrl} className="h-8 w-full" preload="none" />
        </div>
      );
    }
    return (
      <button onClick={fetchMediaUrl} disabled={loading} className="flex items-center gap-2 text-text-3 text-[12px] hover:text-text-1 transition-colors min-w-[180px]">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        <span>{attrs.ptt ? 'Mensagem de voz' : 'Audio'}{duration ? ` (${duration})` : ''}</span>
        {hasMediaFile && !loading && <Play className="w-3 h-3 ml-auto" />}
      </button>
    );
  }

  // Video — inline player
  if (contentType === 'video') {
    if (mediaUrl) {
      return <video controls src={mediaUrl} className="rounded-lg max-w-full max-h-[300px]" preload="none" />;
    }
    return (
      <button onClick={fetchMediaUrl} disabled={loading} className="flex items-center gap-2 text-text-3 text-[12px] hover:text-text-1 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
        <span>Video{duration ? ` (${duration})` : ''}</span>
        {hasMediaFile && !loading && <Play className="w-3 h-3 ml-auto" />}
      </button>
    );
  }

  // Document — download link
  if (contentType === 'document') {
    const fileName = (attrs.fileName as string) || 'Documento';
    if (mediaUrl) {
      return (
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download={fileName} className="flex items-center gap-2 text-accent text-[12px] hover:underline">
          <FileText className="w-4 h-4" />
          <span>{fileName}</span>
          <Download className="w-3 h-3 ml-auto" />
        </a>
      );
    }
    return (
      <button onClick={fetchMediaUrl} disabled={loading} className="flex items-center gap-2 text-text-3 text-[12px] hover:text-text-1 transition-colors">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        <span>{fileName}</span>
        {hasMediaFile && !loading && <Download className="w-3 h-3 ml-auto" />}
      </button>
    );
  }

  // Sticker / Location / fallback — placeholder only
  const fallbackIcons: Record<string, React.ReactNode> = {
    sticker: <Sticker className="w-4 h-4" />,
    location: <MapPin className="w-4 h-4" />,
  };
  const fallbackLabels: Record<string, string> = {
    sticker: 'Figurinha',
    location: 'Localizacao',
  };

  return (
    <div className="flex items-center gap-2 text-text-3 italic text-[12px]">
      {fallbackIcons[contentType] ?? null}
      <span>{fallbackLabels[contentType] ?? contentType}</span>
    </div>
  );
}
