"use client";

import { cn } from "@/lib/utils";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { ASSISTANT_NAME, QUICK_ACTIONS } from "../assistant-helpers";

const SUPPORT_ENABLED = true;

/**
 * The panel's welcome screen: animated mark, time-of-day greeting, the core
 * workflow grid, and the support row. Presentation only; mode selection is a
 * callback so this file stays free of panel state.
 */
export function IvoEmptyState({
  greeting,
  userFirstName,
  activeMode,
  onSelectMode,
}: {
  greeting: string;
  userFirstName?: string | null;
  activeMode: string;
  onSelectMode: (mode: (typeof QUICK_ACTIONS)[number]["mode"]) => void;
}) {
  return (
    <div className="motion-safe:animate-page-enter">
      {/* Hero — animated mark + warm greeting, centered. */}
      <div className="flex flex-col items-center pb-6 pt-4 text-center">
        <span className="relative mb-4 flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-primary/15 motion-safe:animate-ping [animation-duration:2.8s]" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[linear-gradient(140deg,hsl(var(--primary)/0.18),hsl(var(--primary)/0.04))] ring-1 ring-primary/15">
            <StackivoMark className="h-8 w-8" />
          </span>
        </span>
        <p className="text-micro font-semibold uppercase tracking-[0.22em] text-primary/70">
          {ASSISTANT_NAME} · Stackivo AI
        </p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
          {greeting}{userFirstName ? `, ${userFirstName}` : ""} — I&apos;m {ASSISTANT_NAME}
        </h2>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          Tell me what you need in plain words. I&apos;ll help with the admin and keep the next step clear.
        </p>
      </div>

      {/* Even 2-column grid of the six core workflows (the panel is portaled,
          so viewport `md:` breakpoints don't reflect its real width — a fixed
          2-col grid stays balanced at any size). Support gets its own
          full-width row below so nothing is left orphaned. */}
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.filter((a) => a.mode !== "support").map((action, i) => (
          <button
            key={action.mode}
            type="button"
            onClick={() => onSelectMode(action.mode)}
            style={{ animationDelay: `${i * 45}ms` }}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg border bg-background/95 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm motion-safe:animate-page-enter",
              activeMode === action.mode && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
            )}
            title={action.description}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
              <action.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 truncate text-sm font-medium leading-tight">
              {action.title}
            </span>
          </button>
        ))}
      </div>

      {SUPPORT_ENABLED && QUICK_ACTIONS.filter((a) => a.mode === "support").map((action) => (
        <button
          key={action.mode}
          type="button"
          onClick={() => onSelectMode(action.mode)}
          className="group mt-2 flex w-full items-center gap-2.5 rounded-lg border border-dashed bg-background/95 p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
            <action.icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium leading-tight">
              Ask a question or get help
            </span>
            <span className="block text-xs text-muted-foreground">
              Docs, billing, account — or reach the team
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
