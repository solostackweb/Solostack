"use client";

import * as React from "react";
import { Lightbulb, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One transcript row: the bubble, its optional tip, and quick-reply chips.
 * Content arrives already resolved (rich text or a persisted block node);
 * this component owns only bubble geometry, tips, and chip rendering.
 */
export function IvoTranscriptRow({
  role,
  content,
  structured,
  tip,
  suggestions,
  showSuggestions,
  pending,
  onSuggestion,
}: {
  role: "user" | "assistant" | string;
  content: React.ReactNode;
  structured: boolean;
  tip?: string;
  suggestions?: string[];
  showSuggestions: boolean;
  pending: boolean;
  onSuggestion: (suggestion: string) => void;
}) {
  const isUser = role === "user";
  return (
    <div
      className={cn(
        "flex flex-col motion-safe:animate-page-enter",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "whitespace-pre-line px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "max-w-[88%] rounded-2xl rounded-br-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : structured
              ? "mr-auto w-full max-w-[94%] rounded-2xl rounded-bl-lg border border-border/70 bg-background shadow-sm"
              : "mr-auto max-w-[88%] rounded-2xl rounded-bl-lg border border-border/70 bg-background shadow-sm",
        )}
      >
        {content}
        {!isUser && tip ? (
          <span className="mt-2 flex items-start gap-1.5 rounded-lg border border-primary/15 bg-primary/[0.04] px-2.5 py-1.5 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-primary/70" />
            <span>{tip}</span>
          </span>
        ) : null}
      </div>
      {showSuggestions ? (
        <div className="mt-2 flex max-w-[88%] flex-wrap gap-1.5">
          {(suggestions ?? []).map((s, i) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => onSuggestion(s)}
              style={{ animationDelay: `${i * 35}ms` }}
              className="animate-row inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 shrink-0 text-primary" />
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
