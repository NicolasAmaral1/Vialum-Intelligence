interface DateSeparatorProps {
  date: string;
}

export function DateSeparator({ date }: DateSeparatorProps) {
  return (
    <div className="flex justify-center py-3">
      <span className="px-4 py-1.5 rounded-full text-[11px] font-medium bg-surface-custom text-text-3">
        {date}
      </span>
    </div>
  );
}
