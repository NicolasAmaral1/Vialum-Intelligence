import { EmptyState } from '@/components/shared/EmptyState';
import { MessageSquare } from 'lucide-react';

export default function InboxPage() {
  return (
    <EmptyState
      icon={MessageSquare}
      title="Selecione uma conversa"
      description="Escolha uma conversa na lista ao lado para visualizar as mensagens."
    />
  );
}
