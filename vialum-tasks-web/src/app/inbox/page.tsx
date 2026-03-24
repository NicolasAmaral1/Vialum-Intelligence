import { InboxList } from '@/components/inbox/inbox-list';

export default function InboxPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">O que precisa da sua atenção</p>
      </div>

      <InboxList />
    </div>
  );
}
