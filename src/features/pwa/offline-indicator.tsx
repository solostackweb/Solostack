"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { useIsOnline } from "./hooks";

/**
 * Slim global banner that surfaces when the browser reports the device is
 * offline. Sits above all content with safe-area padding so iOS standalone
 * doesn't clip it under the notch.
 *
 * Uses a pure-CSS slide-down keyframe (`animate-toast-down`) so we don't
 * have to load framer-motion just for this one banner.
 */
export function OfflineIndicator() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-down fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[max(env(safe-area-inset-top),0.5rem)]"
    >
      <div className="flex items-center gap-2 rounded-full border border-warning-subtle bg-warning-subtle px-3.5 py-1.5 text-xs font-medium text-warning-strong shadow-sm backdrop-blur-md">
        <WifiOff className="h-3.5 w-3.5" aria-hidden />
        <span>You&apos;re offline. Reconnect to sync.</span>
      </div>
    </div>
  );
}
