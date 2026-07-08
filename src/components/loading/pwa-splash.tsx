"use client";

/**
 * PwaSplash — premium animated launch screen for PWA standalone mode.
 *
 * Shown ONLY when the app is launched from the home screen (standalone PWA).
 * Dismissed automatically after the brand animation completes (~1.4 s).
 *
 * Design intent:
 *   - Adaptive background: dark #0a1020 (matches manifest background_color)
 *     in dark mode, white in light mode
 *   - Centered BrandLoader (xl size) with a calm breathe cycle
 *   - "Stackivo" wordmark fades in below after 300 ms
 *   - Whole overlay fades out with splash-exit after init
 *   - `prefers-reduced-motion`: still shows but exits immediately (200 ms)
 *
 * Implementation:
 *   Mount in AppProviders. Component detects standalone mode on the client,
 *   so it never flashes in browser tabs. Exits via CSS animation, then
 *   unmounts from the DOM to eliminate any z-index overhead.
 */

import * as React from "react";
import { BrandLoader } from "./brand-loader";

const SPLASH_DURATION = 1600; // ms before exit begins
const EXIT_DURATION   = 500;  // ms for fade-out animation

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari: window.navigator.standalone is non-standard but reliable
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function PwaSplash() {
  const [show, setShow]     = React.useState(false);
  const [exiting, setExiting] = React.useState(false);
  const [gone, setGone]     = React.useState(false);

  // Detect standalone on first client render
  React.useEffect(() => {
    if (!isStandalone()) return;

    // Only show on cold start — session flag prevents re-show on soft nav
    if (sessionStorage.getItem("stackivo_splash_shown")) return;
    sessionStorage.setItem("stackivo_splash_shown", "1");

    setShow(true);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduceMotion ? 0 : SPLASH_DURATION;

    const exitTimer = setTimeout(() => {
      setExiting(true);
      const goneTimer = setTimeout(() => setGone(true), EXIT_DURATION);
      return () => clearTimeout(goneTimer);
    }, hold);

    return () => clearTimeout(exitTimer);
  }, []);

  if (!show || gone) return null;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        // Adaptive: matches the PWA manifest background_color
        background: "var(--splash-bg, #0a1020)",
        willChange: "opacity",
        animation: exiting
          ? `splash-exit ${EXIT_DURATION}ms cubic-bezier(0.4,0,1,1) forwards`
          : undefined,
      }}
      className="dark:bg-[#0a1020] bg-white"
    >
      {/* Brand icon — internal cascade animation handles everything */}
      <BrandLoader size="xl" animate />

      {/* Wordmark */}
      <p
        style={{
          margin: 0,
          fontSize: "15px",
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "#94a3b8",
          opacity: 0,
          animation: "fade-in 0.5s ease 0.3s both",
          fontFamily: "var(--font-sans, system-ui, sans-serif)",
        }}
        className="motion-reduce:opacity-100 motion-reduce:animate-none"
      >
        STACKIVO
      </p>
    </div>
  );
}
