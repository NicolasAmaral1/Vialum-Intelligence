'use client';

import { cn } from '@/lib/utils';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ContactAvatar } from '@/components/shared/AvatarFallback';
import { ReadReceipts } from './ReadReceipts';
import { Lock, Image, Mic, Video, FileText, MapPin, Sticker } from 'lucide-react';
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

  const displayContent = message.content || null;
  const hasMedia = !displayContent && message.contentType !== 'text';

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

        {displayContent ? (
          <span className="text-text-1 whitespace-pre-wrap break-words">{displayContent}</span>
        ) : hasMedia ? (
          <MediaPlaceholder contentType={message.contentType} attributes={message.contentAttributes} />
        ) : null}

        <div className="flex items-center justify-end gap-0.5 mt-0.5">
          <RelativeTime date={message.createdAt} className="text-[10px] text-text-4" />
          {isOutgoing && <ReadReceipts status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function MediaPlaceholder({ contentType, attributes }: { contentType: string; attributes: Record<string, unknown> }) {
  const config: Record<string, { icon: React.ReactNode; label: string }> = {
    audio: { icon: <Mic className="w-4 h-4" />, label: attributes.ptt ? 'Mensagem de voz' : 'Áudio' },
    image: { icon: <Image className="w-4 h-4" />, label: 'Imagem' },
    video: { icon: <Video className="w-4 h-4" />, label: 'Vídeo' },
    document: { icon: <FileText className="w-4 h-4" />, label: (attributes.fileName as string) || 'Documento' },
    location: { icon: <MapPin className="w-4 h-4" />, label: 'Localização' },
    sticker: { icon: <Sticker className="w-4 h-4" />, label: 'Figurinha' },
  };

  const { icon, label } = config[contentType] ?? { icon: null, label: contentType };

  const duration = attributes.seconds ? ` (${Math.floor(attributes.seconds as number / 60)}:${String((attributes.seconds as number) % 60).padStart(2, '0')})` : '';

  return (
    <div className="flex items-center gap-2 text-text-3 italic text-[12px]">
      {icon}
      <span>{label}{duration}</span>
    </div>
  );
}
