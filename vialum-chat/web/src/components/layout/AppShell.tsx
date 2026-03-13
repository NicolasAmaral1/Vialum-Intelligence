'use client';

import { NavSidebar } from './NavSidebar';
import { CommandBar } from '@/components/shared/CommandBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen overflow-hidden">
      <NavSidebar />
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
      <CommandBar />
    </div>
  );
}
