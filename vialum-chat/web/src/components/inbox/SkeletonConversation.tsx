export function SkeletonConversation() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 animate-pulse">
      <div className="w-10 h-10 rounded-full shrink-0 bg-surface-custom" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-3 w-24 rounded bg-surface-custom" />
          <div className="h-3 w-10 rounded bg-surface-custom" />
        </div>
        <div className="h-3 w-40 rounded bg-surface-custom" />
      </div>
    </div>
  );
}
