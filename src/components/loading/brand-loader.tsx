"use client";

/**
 * BrandLoader — the animated heartbeat of Stackivo.
 *
 * Renders the three-bar Stackivo mark with a two-phase GPU-only animation:
 *
 *   Phase 1 (mount, one-shot):
 *     • The container pops in from scale 0.85 → 1 (350 ms, spring ease).
 *     • Bars 1, 2, 3 slide in from the left and fade up to their base
 *       opacities, staggered at 60 ms / 180 ms / 300 ms.
 *
 *   Phase 2 (idle loop, starts at ~720 ms):
 *     • Container breathes: opacity 1 → 0.82 → 1 every 2.8 s.
 *     • Each bar pulses independently in a top-to-bottom cascade — bar 1
 *       leads, bar 2 follows 220 ms later, bar 3 follows 220 ms after that.
 *       Each bar dims to ~28 % of its base opacity at the trough, creating
 *       a flowing "stack" wave that reads as activity without being jarring.
 *
 * All animations use `transform` and `opacity` exclusively — zero layout
 * thrashing, GPU-composited. `prefers-reduced-motion` stops every keyframe
 * via the @media wrapper in the inline <style> tag.
 *
 * Sizes:
 *   sm  — 32 px  (inline / button-area)
 *   md  — 56 px  (section / card centre)
 *   lg  — 80 px  (page-level)
 *   xl  — 112 px (splash / fullscreen)
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export type BrandLoaderSize = "sm" | "md" | "lg" | "xl";

// ── Size table ────────────────────────────────────────────────────────────────
// Bars are left-aligned, decreasing in width (100% → 72% → 47%) with
// base opacities 1.0 / 0.72 / 0.40 — matching the static brand mark exactly.

const SIZE: Record<
  BrandLoaderSize,
  {
    px: number;
    rx: number;
    bars: { x: number; y: number; w: number; h: number; op: number }[];
  }
> = {
  sm: {
    px: 32,
    rx: 7,
    bars: [
      { x: 6,  y: 8,  w: 20,   h: 5, op: 1.00 },
      { x: 6,  y: 15, w: 14.5, h: 5, op: 0.72 },
      { x: 6,  y: 22, w: 9.5,  h: 5, op: 0.40 },
    ],
  },
  md: {
    px: 56,
    rx: 12,
    bars: [
      { x: 11, y: 13, w: 34,   h: 9, op: 1.00 },
      { x: 11, y: 25, w: 24.5, h: 9, op: 0.72 },
      { x: 11, y: 37, w: 16,   h: 9, op: 0.40 },
    ],
  },
  lg: {
    px: 80,
    rx: 17,
    bars: [
      { x: 15, y: 19, w: 50,   h: 13, op: 1.00 },
      { x: 15, y: 36, w: 36,   h: 13, op: 0.72 },
      { x: 15, y: 53, w: 23.5, h: 13, op: 0.40 },
    ],
  },
  xl: {
    px: 112,
    rx: 24,
    bars: [
      { x: 20, y: 26, w: 72, h: 18, op: 1.00 },
      { x: 20, y: 48, w: 52, h: 18, op: 0.72 },
      { x: 20, y: 70, w: 34, h: 18, op: 0.40 },
    ],
  },
};

// Wave loop start delay per bar (ms) — bar 0 leads, 1 and 2 follow at 220 ms steps.
const WAVE_DELAYS_MS = [720, 940, 1160] as const;

// ── Inline keyframes ──────────────────────────────────────────────────────────
// Built per-instance so multiple BrandLoaders on the same page never collide.

function buildStyles(
  id: string,
  bars: (typeof SIZE)["sm"]["bars"],
): string {
  const [b0, b1, b2] = bars;
  return `
    @media (prefers-reduced-motion: no-preference) {
      @keyframes ${id}-pop {
        from { opacity: 0; transform: scale(0.85); }
        to   { opacity: 1; transform: scale(1);    }
      }
      @keyframes ${id}-breathe {
        0%, 100% { opacity: 1;    }
        50%       { opacity: 0.82; }
      }
      @keyframes ${id}-r0 {
        from { opacity: 0;       transform: translateX(-4px); }
        to   { opacity: ${b0.op}; transform: translateX(0);   }
      }
      @keyframes ${id}-r1 {
        from { opacity: 0;       transform: translateX(-4px); }
        to   { opacity: ${b1.op}; transform: translateX(0);   }
      }
      @keyframes ${id}-r2 {
        from { opacity: 0;       transform: translateX(-4px); }
        to   { opacity: ${b2.op}; transform: translateX(0);   }
      }
      @keyframes ${id}-w0 {
        0%, 100% { opacity: ${b0.op};                      }
        50%       { opacity: ${(b0.op * 0.28).toFixed(3)}; }
      }
      @keyframes ${id}-w1 {
        0%, 100% { opacity: ${b1.op};                      }
        50%       { opacity: ${(b1.op * 0.28).toFixed(3)}; }
      }
      @keyframes ${id}-w2 {
        0%, 100% { opacity: ${b2.op};                      }
        50%       { opacity: ${(b2.op * 0.28).toFixed(3)}; }
      }
      .${id}-mark {
        animation:
          ${id}-pop     0.35s cubic-bezier(0.22, 1, 0.36, 1) both,
          ${id}-breathe 2.8s  ease-in-out 0.72s infinite;
      }
      .${id}-b0 {
        animation:
          ${id}-r0 0.48s cubic-bezier(0.22, 1, 0.36, 1) 0.06s both,
          ${id}-w0 1.8s ease-in-out ${WAVE_DELAYS_MS[0]}ms infinite;
      }
      .${id}-b1 {
        animation:
          ${id}-r1 0.48s cubic-bezier(0.22, 1, 0.36, 1) 0.18s both,
          ${id}-w1 1.8s ease-in-out ${WAVE_DELAYS_MS[1]}ms infinite;
      }
      .${id}-b2 {
        animation:
          ${id}-r2 0.48s cubic-bezier(0.22, 1, 0.36, 1) 0.30s both,
          ${id}-w2 1.8s ease-in-out ${WAVE_DELAYS_MS[2]}ms infinite;
      }
    }
  `;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface BrandLoaderProps {
  size?: BrandLoaderSize;
  /**
   * When true the two-phase animation runs (mount pop → idle cascade).
   * When false the mark renders static at base opacities — use this when
   * an external wrapper is controlling the animation (e.g. PwaSplash).
   */
  animate?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function BrandLoader({
  size = "md",
  animate = true,
  className,
  "aria-label": ariaLabel = "Loading…",
}: BrandLoaderProps) {
  // Stable unique id per instance — avoids keyframe name collisions.
  const rawId = React.useId();
  const styleId = `stk${rawId.replace(/:/g, "")}`;

  const { px, rx, bars } = SIZE[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={ariaLabel}
      className={cn("will-change-[opacity,transform]", className)}
    >
      {animate && <style>{buildStyles(styleId, bars)}</style>}

      <defs>
        <linearGradient id={`${styleId}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#2563EB" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
        {/* Subtle depth glow — only visible at lg/xl, cheap blur composite */}
        <filter id={`${styleId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={px * 0.035} result="blur" />
          <feComposite   in="SourceGraphic" in2="blur"              operator="over" />
        </filter>
      </defs>

      {/* Gradient container */}
      <rect
        width={px}
        height={px}
        rx={rx}
        ry={rx}
        fill={`url(#${styleId}-grad)`}
        filter={`url(#${styleId}-glow)`}
        className={animate ? `${styleId}-mark` : undefined}
      />

      {/* Three cascade bars */}
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x}
          y={bar.y}
          width={bar.w}
          height={bar.h}
          rx={bar.h / 2}
          ry={bar.h / 2}
          fill="#FFFFFF"
          opacity={animate ? undefined : bar.op}
          className={animate ? `${styleId}-b${i}` : undefined}
        />
      ))}
    </svg>
  );
}
