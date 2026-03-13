import { Check, CheckCheck, Clock, X } from 'lucide-react';

interface ReadReceiptsProps {
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export function ReadReceipts({ status }: ReadReceiptsProps) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3 inline-block ml-1 text-text-4" />;
    case 'sent':
      return <Check className="w-3 h-3 inline-block ml-1 text-text-4" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 inline-block ml-1 text-text-4" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 inline-block ml-1 text-primary" />;
    case 'failed':
      return <X className="w-3 h-3 inline-block ml-1 text-danger" />;
    default:
      return null;
  }
}
