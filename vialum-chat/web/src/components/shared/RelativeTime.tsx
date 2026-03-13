'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RelativeTimeProps {
  date: string;
  className?: string;
}

export function RelativeTime({ date, className }: RelativeTimeProps) {
  const formatted = formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <time dateTime={date} className={className} title={new Date(date).toLocaleString('pt-BR')}>
      {formatted}
    </time>
  );
}
