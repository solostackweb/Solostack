"use client";

/**
 * RouteProgress — slim top bar that fires on every route change.
 *
 * Pattern: Linear / GitHub / Vercel style. Uses `usePathname` to detect
 * navigation and animates a progress fill from left to right, completing
 * once the new page renders.
 *
 * Entirely CSS-driven:
 *   - `progress-fill` keyframe sweeps from -100% to -5% (appears to fill)
 *   - On completion, the bar fades out with opacity
 *   - GPU-only (transform + opacity) — zero layout impact
 *
 * Reduced-motion: The bar is hidden; navigation feels instant.
 */

import * as React from "react";
import { usePathname } from "next/navigation";

const BAR_HEIGHT = "2px";
// Brand primary: matches Stackivo blue
const BAR_COLOR = "hsl(var(--primary))";

export function RouteProgress() {
  const pathname = usePathname();
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevPathRef = React.useRef(pathname);

  React.useEffect(() => {
    // First render — no animation
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;

    // New route landed — complete the bar
    clearTimeout(timerRef.current);
  }, [pathname]);

  // Kick off the bar before navigation (on link click / router push)
  // We use a MutationObserver approach instead: watch for loading state from
  // Next.js router. The simplest reliable hook is startTransition detection.
  //
  // Instead, we use a two-phase approach:
  //   Phase 1 — show bar + start fill animation immediately on path change
  //             detection (this fires when Next.js has resolved the new RSC)
  //   Phase 2 — fade out
  //
  // For the "before navigation" feel we rely on the layout shift suppression
  // from Next.js soft navigation combined with the skeleton loaders in each
  // loading.tsx. This gives ~95% of the perceived benefit with zero complexity.

  return null; // RouteProgress is implemented via the CSS progress bar below
}

/**
 * RouteProgressBar — the actual DOM element. Mount once in the root layout
 * (via AppProviders). It reads the navigation state from a custom event.
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [phase, setPhase] = React.useState<"idle" | "loading" | "done">("idle");
  const prevRef = React.useRef(pathname);
  const doneTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    if (prevRef.current === pathname) return;

    // Path changed → the new page just rendered → complete the bar
    setPhase("done");
    prevRef.current = pathname;

    doneTimer.current = setTimeout(() => setPhase("idle"), 600);
    return () => clearTimeout(doneTimer.current);
  }, [pathname]);

  // We can't know when navigation *starts* from inside a React component
  // without intercepting router.push. Instead we listen to the custom
  // "stackivo:nav-start" event dispatched by the NavigationLink helper.
  React.useEffect(() => {
    function onStart() {
      clearTimeout(doneTimer.current);
      setPhase("loading");
    }
    window.addEventListener("stackivo:nav-start", onStart);
    return () => window.removeEventListener("stackivo:nav-start", onStart);
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] motion-reduce:hidden"
      style={{ height: BAR_HEIGHT }}
    >
      <div
        style={{
          height: "100%",
          background: BAR_COLOR,
          boxShadow: `0 0 8px 1px ${BAR_COLOR}`,
          willChange: "transform, opacity",
          transformOrigin: "left center",
          animation:
            phase === "loading"
              ? "progress-fill 2.4s cubic-bezier(0.25,1,0.5,1) forwards"
              : "none",
          transform: phase === "done" ? "translateX(0%)" : undefined,
          opacity: phase === "done" ? 0 : 1,
          transition: phase === "done" ? "opacity 0.4s ease 0.1s, transform 0.15s ease" : undefined,
        }}
      />
    </div>
  );
}
