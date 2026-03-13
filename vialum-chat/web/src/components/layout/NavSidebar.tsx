'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { useSuggestionsStore } from '@/stores/suggestions.store';
import {
  MessageSquare,
  Sparkles,
  Tags,
  MessageCircle,
  Zap,
  GitBranch,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { href: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { href: '/ai-queue', icon: Sparkles, label: 'Fila IA', badge: true },
  { href: '/labels', icon: Tags, label: 'Labels' },
  { href: '/canned-responses', icon: MessageCircle, label: 'Respostas rápidas' },
  { href: '/automation', icon: Zap, label: 'Automação' },
  { href: '/treeflows', icon: GitBranch, label: 'TreeFlows' },
  { href: '/contacts', icon: Users, label: 'Contatos' },
  { href: '/settings/account', icon: Settings, label: 'Configurações' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function NavSidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pendingTotal = useSuggestionsStore((s) => s.pendingTotal);

  return (
    <TooltipProvider delayDuration={0}>
      <nav className="flex flex-col items-center w-[72px] h-full bg-nav border-r border-border-subtle py-5 gap-1">
        {/* Logo */}
        <div className="mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-[hsl(84,87%,38%)] flex items-center justify-center text-primary-foreground font-bold text-lg shadow-[0_0_24px_rgba(159,236,20,0.2)]">
            V
          </div>
        </div>

        {/* Nav items */}
        <div className="flex-1 flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'relative flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-primary/[0.14] text-primary shadow-[0_0_16px_rgba(159,236,20,0.08)]'
                        : 'text-text-3 hover:bg-white/[0.05]'
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                    {item.badge && pendingTotal > 0 && (
                      <Badge
                        className="absolute -top-1 -right-1 h-[18px] min-w-[18px] flex items-center justify-center p-0 text-[9px] font-semibold bg-primary text-primary-foreground border-0"
                      >
                        {pendingTotal > 99 ? '99+' : pendingTotal}
                      </Badge>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-overlay text-text-2 text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Logout */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => logout()}
              className="flex items-center justify-center h-10 w-10 rounded-xl text-text-3 hover:bg-white/[0.05] transition-all duration-200"
            >
              <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-overlay text-text-2 text-xs">
            Sair
          </TooltipContent>
        </Tooltip>

        {/* User avatar */}
        {user && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative mt-2">
                <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-semibold">
                  {getInitials(user.name)}
                </div>
                <div className="w-3 h-3 rounded-full bg-success border-2 border-nav absolute -bottom-0.5 -right-0.5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-overlay text-text-2 text-xs">
              {user.name}
            </TooltipContent>
          </Tooltip>
        )}
      </nav>
    </TooltipProvider>
  );
}
