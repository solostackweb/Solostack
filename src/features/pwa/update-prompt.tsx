"use client";

import * as React from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SW_UPDATE_READY_EVENT,
  applyServiceWorkerUpdate,
} from "./service-worker-register";

/**
 * Floating "Update available" prompt for installed PWAs.
 *
 * Surfaces only when the service worker has a newly-installed worker sitting
 * in the `waiting` state — i.e. there's a fresh shell ready that the user
 * hasn't picked up yet. Clicking "Refresh" sends SKIP_WAITING; the
 * controller-change listener in `ServiceWorkerRegister` reloads the page.
 *
 * The "Later" button hides the toast for the current session only — we do
 * NOT persist a long-lived dismissal because shipping bug fixes should be
 * picked up the next time the page loads anyway.
 */
export function UpdatePrompt() {
  const [show, setShow] = React.useState(false);
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onReady = () => setShow(true);
    window.addEventListener(SW_UPDATE_READY_EVENT, onReady);
    return () => window.removeEventListener(SW_UPDATE_READY_EVENT, onReady);
  }, []);

  const handleRefresh = () => {
    setApplying(true);
    applyServiceWorkerUpdate();
  };

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        bottom:
          "calc(var(--mobile-bottom-nav-h, 0px) + env(safe-area-inset-bottom, 0px) + 1rem)",
      }}
      className="animate-toast-up fixed inset-x-3 z-[55] mx-auto flex max-w-md items-center gap-3 rounded-lg border bg-card/95 p-3 shadow-lg backdrop-blur-xl sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-indigo-500/15 text-primary ring-1 ring-primary/20">
        <Sparkles className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">
          New version available
        </p>
        <p className="mt-0.5 text-[11.5px] leading-tight text-muted-foreground">
          Refresh to get the latest improvements.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          onClick={handleRefresh}
          disabled={applying}
          className="h-8 gap-1.5 px-3 text-xs"
        >
          <RefreshCw
            className={"h-3.5 w-3.5 " + (applying ? "animate-spin" : "")}
            aria-hidden
          />
          {applying ? "Updating" : "Refresh"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShow(false)}
          className="h-8 w-8 text-muted-foreground"
          aria-label="Dismiss update prompt"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
