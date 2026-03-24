import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vialum Tasks',
  description: 'Hub operacional HITL',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${sora.variable} font-sans`}>
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-border flex flex-col">
            {/* Logo */}
            <div className="h-14 flex items-center px-5 border-b border-border">
              <span className="text-primary font-bold text-lg tracking-tight">Vialum</span>
              <span className="text-muted-foreground font-medium text-lg ml-1">Tasks</span>
            </div>

            {/* Nav */}
            <nav className="flex-1 p-3 space-y-1">
              <NavLink href="/inbox" icon="inbox">Inbox</NavLink>
              <NavLink href="/workflows/new" icon="plus">Novo Workflow</NavLink>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Genesis Marcas</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <NavIcon name={icon} />
      {children}
    </a>
  );
}

function NavIcon({ name }: { name: string }) {
  // Simple inline SVG icons to avoid heavy icon dep on initial load
  switch (name) {
    case 'inbox':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-17.5 0V6.75A2.25 2.25 0 014.5 4.5h15A2.25 2.25 0 0121.75 6.75v6.75" />
        </svg>
      );
    case 'plus':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      );
    default:
      return null;
  }
}
