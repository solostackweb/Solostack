"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/** The visible states of the header presence line. */
export type IvoPresencePhase = "idle" | "thinking" | "reading" | "writing";

const PHASE_LABELS: Record<IvoPresencePhase, string> = {
  idle: "Ivo · Connected",
  thinking: "Thinking…",
  reading: "Reading your workspace…",
  writing: "Writing…",
};

/**
 * Header identity cluster: mode icon tile, conversation title button, and the
 * presence line. At rest it looks exactly like the old static "Connected"
 * state; while Ivo works, the dot pulses primary and the label names the
 * phase. Pulse is motion-safe and opacity-only per the design system.
 */
export function IvoHeaderPresence({
  icon,
  title,
  phase = "idle",
  menuOpen,
  onToggleMenu,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  phase?: IvoPresencePhase;
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const Icon = icon;
  const active = phase !== "idle";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 font-semibold">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-lg px-1 py-0.5 text-left hover:bg-muted"
        onClick={onToggleMenu}
        aria-expanded={menuOpen}
        aria-label="Open conversation history"
      >
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span
            className={cn(
              "flex items-center gap-1.5 truncate text-micro font-medium",
              active ? "text-muted-foreground" : "text-success-strong",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                active
                  ? "bg-primary motion-safe:animate-pulse [animation-duration:1.6s]"
                  : "bg-success-strong",
              )}
            />
            {PHASE_LABELS[phase]}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            menuOpen && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}
