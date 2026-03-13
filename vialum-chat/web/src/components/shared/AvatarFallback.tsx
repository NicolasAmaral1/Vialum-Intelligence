import { Avatar, AvatarFallback as AvatarFB, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ContactAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function getColorFromName(name: string): string {
  const colors = [
    'bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-amber-600',
    'bg-rose-600', 'bg-cyan-600', 'bg-fuchsia-600', 'bg-lime-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function ContactAvatar({ name, avatarUrl, className }: ContactAvatarProps) {
  return (
    <Avatar className={cn('h-9 w-9', className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFB className={cn('text-white text-xs', getColorFromName(name))}>
        {getInitials(name)}
      </AvatarFB>
    </Avatar>
  );
}
