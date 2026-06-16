"use client";

/** Three softly-bouncing dots — inherits text color via `bg-current`. */
export function TypingDots({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`} aria-label="typing">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70 [animation-delay:-0.32s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70 [animation-delay:-0.16s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70" />
    </span>
  );
}
