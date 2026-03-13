'use client';

import { ConversationList } from '@/components/inbox/ConversationList';

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full">
      <ConversationList />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
