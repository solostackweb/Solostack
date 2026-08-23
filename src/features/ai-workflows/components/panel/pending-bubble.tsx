"use client";

import * as React from "react";

import { formatAssistantMessageContent } from "@/features/ai-workflows/assistant-text";

/**
 * The live assistant bubble shown while a message is processing: bouncing
 * dots plus the current phase label until tokens stream, then the partial
 * reply with a caret. Presentation only - the transcript owns when it renders.
 */
export function IvoPendingBubble({
  liveReply,
  agentStatus,
}: {
  liveReply: string;
  agentStatus: string | null;
}) {
  return (
    <div className="flex justify-start" role="status" aria-live="polite" aria-label="Ivo is responding">
      <div className="max-w-[85%] rounded-2xl rounded-bl-lg border border-border/70 bg-background px-4 py-3 shadow-sm">
        {liveReply ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {formatAssistantMessageContent(liveReply.replace(/\n?\s*\[chips\][\s\S]*$/i, ""))}
            <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse rounded bg-primary/70 align-middle" />
          </p>
        ) : (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((item) => (
                <span
                  key={item}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
                  style={{ animationDelay: `${item * 120}ms` }}
                />
              ))}
            </span>
            {agentStatus ? (
              <span
                key={agentStatus}
                className="motion-safe:animate-fade-in text-xs text-muted-foreground"
              >
                {agentStatus}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Thinking with your workspace context…</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
