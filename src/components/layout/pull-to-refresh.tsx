"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Native-style pull-to-refresh for the installed PWA.
 *
 * Only active in standalone display mode on a touch device — there the browser's
 * own pull-to-refresh is disabled (overscroll-behavior:none in globals.css), so
 * this fills the gap. Pulling down from the very top reveals a spinner; past the
 * threshold it triggers a router refresh. In a normal browser tab we do nothing
 * and let the browser's native gesture work.
 */
const THRESHOLD = 72;

export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const pullRef = React.useRef(0);
  const startY = React.useRef<number | null>(null);
  const tracking = React.useRef(false);
  const busy = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (!standalone || !coarse) return;

    const setPullBoth = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    const onStart = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) {
        tracking.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullRef.current !== 0) setPullBoth(0);
        return;
      }
      // Rubber-band resistance.
      setPullBoth(Math.min(dy * 0.5, 96));
    };
    const onEnd = () => {
      if (!tracking.current) return;
      tracking.current = false;
      startY.current = null;
      if (pullRef.current >= THRESHOLD) {
        busy.current = true;
        setRefreshing(true);
        setPullBoth(THRESHOLD);
        router.refresh();
        window.setTimeout(() => {
          busy.current = false;
          setRefreshing(false);
          setPullBoth(0);
        }, 900);
      } else {
        setPullBoth(0);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  if (pull <= 0 && !refreshing) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      aria-hidden
    >
      <div
        className="ptr-spinner mt-2 flex h-9 w-9 items-center justify-center rounded-full border bg-card shadow-md"
        style={{
          transform: `translateY(${Math.max(0, pull - 14)}px)`,
          opacity: Math.min(1, pull / THRESHOLD),
        }}
      >
        <Loader2
          className={`h-4 w-4 text-primary ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </div>
    </div>
  );
}
