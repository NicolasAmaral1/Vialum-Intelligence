'use client';

import { NavSidebar } from './NavSidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <NavSidebar />
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
