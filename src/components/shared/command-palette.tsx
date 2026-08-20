"use client";

/**
 * Command palette TRIGGER — light client component.
 *
 * Owns:
 *  - Open/close state for the palette dialog
 *  - The global ⌘K keyboard shortcut
 *  - The Linear/Vercel-style trigger pill
 *
 * Does NOT pull in `cmdk` directly. The dialog body lives in
 * `command-palette-dialog.tsx` and is loaded via `next/dynamic` only
 * after the user actually opens the palette (`hasOpened`). This keeps
 * cmdk + the full nav graph + next-themes hook out of the initial
 * dashboard JS budget — they arrive on demand the first time ⌘K is
 * pressed.
 */

import * as React from "react";
import dynamic from "next/dynamic";

const CommandPaletteDialog = dynamic(
  () => import("./command-palette-dialog").then((m) => m.CommandPalette),
  { ssr: false },
);

export function CommandPaletteTrigger({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  // Latched to `true` on first open so subsequent ⌘K presses don't
  // unmount the (now-loaded) dialog. Keeps cmdk warm in memory after
  // first use without ever loading it before then.
  const [hasOpened, setHasOpened] = React.useState(false);

  const handleOpenChange = React.useCallback((next: boolean) => {
    if (next) setHasOpened(true);
    setOpen(next);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setHasOpened(true);
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => handleOpenChange(true)}
        className={
          "group inline-flex h-9 w-full max-w-sm items-center gap-2 rounded-full border bg-muted/40 px-3.5 text-sm text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted hover:text-foreground hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-ring " +
          (className ?? "")
        }
        aria-label="Open command palette"
      >
        <svg
          className="h-4 w-4 shrink-0 transition-colors group-hover:text-primary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded-lg border bg-background px-1.5 font-mono text-micro font-semibold text-muted-foreground shadow-sm">
          <span className="text-micro leading-none">⌘</span>K
        </kbd>
      </button>
      {hasOpened ? (
        <CommandPaletteDialog open={open} onOpenChange={handleOpenChange} />
      ) : null}
    </>
  );
}
