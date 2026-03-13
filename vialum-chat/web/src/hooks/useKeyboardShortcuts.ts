'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Global keyboard shortcuts for the app.
 * Cmd+K is handled by CommandBar directly.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Only Escape is allowed from inputs
        if (e.key !== 'Escape') return;
      }

      const meta = e.metaKey || e.ctrlKey;

      // Cmd+I → Inbox
      if (meta && e.key === 'i') {
        e.preventDefault();
        router.push('/inbox');
        return;
      }

      // Cmd+T → Tree Flows
      if (meta && e.key === 't') {
        e.preventDefault();
        router.push('/treeflows');
        return;
      }

      // Escape → close sidebar / go back to inbox
      if (e.key === 'Escape' && !meta && !e.shiftKey) {
        // If on a conversation page, go back to inbox
        if (pathname?.startsWith('/inbox/')) {
          e.preventDefault();
          router.push('/inbox');
          return;
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router, pathname]);
}
