"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";

/**
 * Reduced-motion for JS-driven animation.
 *
 * The `@media (prefers-reduced-motion: reduce)` block in globals.css zeroes
 * `animation-duration` and `transition-duration`, which covers every CSS
 * keyframe and Tailwind `animate-*` utility. It does **not** cover Motion:
 * Motion animates by writing inline `transform` on each frame from JS, so a
 * CSS duration override never applies to it. Before this provider existed the
 * hero `Floating` loop (`repeat: Infinity`) kept running for users who had
 * asked the OS for no motion.
 *
 * `MotionConfig reducedMotion` is Motion's own switch:
 *   "user"   — follow the OS setting; transform and layout animations are
 *              skipped, opacity still animates (per WCAG 2.3.3 this is the
 *              behaviour you want — fades are not vestibular triggers)
 *   "always" — force it on regardless of OS
 *
 * Stackivo also ships an in-app toggle (Appearance settings) that sets
 * `data-reduced-motion="true"` on <html> so a user can opt in without touching
 * their OS. That attribute has to be mirrored here, otherwise the toggle would
 * silence CSS animation but leave Motion running.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [forced, setForced] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const read = () => setForced(root.getAttribute("data-reduced-motion") === "true");

    read();
    const observer = new MutationObserver(read);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-reduced-motion"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion={forced ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
