export function SkeletonMessages() {
  return (
    <div className="space-y-4 animate-pulse px-5 py-4 max-w-3xl mx-auto">
      {/* Incoming */}
      <div className="flex justify-start">
        <div className="w-7 h-7 rounded-full shrink-0 bg-surface-custom" />
        <div className="ml-2 space-y-1">
          <div className="h-3 w-20 rounded bg-surface-custom" />
          <div className="h-10 w-56 rounded-2xl rounded-bl-[4px] bg-bubble-in" />
        </div>
      </div>
      {/* Outgoing */}
      <div className="flex justify-end">
        <div className="h-10 w-64 rounded-2xl rounded-br-[4px] bg-bubble-out" />
      </div>
      {/* Incoming */}
      <div className="flex justify-start">
        <div className="w-7 h-7 rounded-full shrink-0 bg-surface-custom" />
        <div className="ml-2">
          <div className="h-10 w-48 rounded-2xl rounded-bl-[4px] bg-bubble-in" />
        </div>
      </div>
    </div>
  );
}
