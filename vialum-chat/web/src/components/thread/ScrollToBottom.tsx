import { ChevronDown } from 'lucide-react';

interface ScrollToBottomProps {
  onClick: () => void;
  newCount?: number;
}

export function ScrollToBottom({ onClick, newCount }: ScrollToBottomProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 w-10 h-10 rounded-full shadow-lg flex items-center justify-center bg-surface-custom border border-border text-text-3 hover:brightness-125 transition-all z-10"
    >
      <ChevronDown className="w-5 h-5" />
      {newCount && newCount > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center bg-primary text-primary-foreground">
          {newCount > 99 ? '99+' : newCount}
        </span>
      ) : null}
    </button>
  );
}
