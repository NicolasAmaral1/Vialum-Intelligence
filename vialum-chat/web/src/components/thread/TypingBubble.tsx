export function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl rounded-bl-[4px] px-4 py-3 flex items-center gap-1.5 bg-bubble-in border border-bubble-in-border">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-[6px] h-[6px] rounded-full bg-text-3 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
