import * as React from "react";
import { cn } from "@/lib/utils";
import { BRAND_PRIMARY, BRAND_ACCENT } from "@/config/brand-colors";

/**
 * Stackivo brand system.
 *
 * The mark is three left-aligned rounded bars in a square container, each
 * progressively shorter and more transparent — reading as a stack (Stackivo)
 * and as a data/progress metaphor. The three-step cascade works at every size
 * from 16 px favicon to large marketing lockups.
 *
 * Three components:
 *   - <StackivoMark/>     — square icon mark, all variants, all sizes.
 *   - <StackivoWordmark/> — text-only "Stackivo" set in tight tracking.
 *   - <StackivoLogo/>     — mark + wordmark lockup (default nav/header).
 *
 * Variants:
 *   color    Gradient container, white bars. Default for the app + marketing.
 *   mono     Currentcolor container, white bars. Use on solid coloured panels.
 *   white    Transparent container, white bars. Use over imagery / dark sections.
 *   outline  Transparent container, currentcolor bars. PDF/print/email.
 */

type Variant = "color" | "mono" | "white" | "outline";

interface StackivoMarkProps {
  variant?: Variant;
  className?: string;
  bare?: boolean;
  decorative?: boolean;
}

export function StackivoMark({
  variant = "color",
  className,
  bare = false,
  decorative = true,
}: StackivoMarkProps) {
  const a11y = decorative
    ? { "aria-hidden": true as const, focusable: false as const }
    : { role: "img" as const, "aria-label": "Stackivo" };

  const barFill = variant === "outline" ? "currentColor" : "#FFFFFF";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        !bare && "rounded-[22%] shadow-sm",
        !bare &&
          variant === "color" &&
          "bg-gradient-to-br from-primary via-primary to-blue-700",
        !bare && variant === "mono" && "bg-current text-primary",
        !bare && variant === "white" && "bg-transparent",
        !bare &&
          variant === "outline" &&
          "bg-transparent ring-1 ring-current/25",
        "h-8 w-8",
        className,
      )}
      {...a11y}
    >
      <svg
        viewBox="0 0 512 512"
        width="70%"
        height="70%"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Bar 1 — full width, full opacity */}
        <rect x="88" y="96"  width="336" height="68" rx="34" fill={barFill} />
        {/* Bar 2 — 72 % width */}
        <rect x="88" y="228" width="242" height="68" rx="34" fill={barFill}
              opacity={variant === "outline" ? 0.55 : 0.72} />
        {/* Bar 3 — 47 % width */}
        <rect x="88" y="360" width="158" height="68" rx="34" fill={barFill}
              opacity={variant === "outline" ? 0.30 : 0.40} />
      </svg>
    </span>
  );
}

interface StackivoWordmarkProps {
  className?: string;
  text?: string;
}

export function StackivoWordmark({
  className,
  text = "Stackivo",
}: StackivoWordmarkProps) {
  return (
    <span
      className={cn(
        "inline-block font-semibold tracking-tight leading-none",
        className,
      )}
    >
      {text}
    </span>
  );
}

interface StackivoLogoProps {
  variant?: Variant;
  className?: string;
  iconOnly?: boolean;
  wordmark?: string;
}

export function StackivoLogo({
  variant = "color",
  className,
  iconOnly = false,
  wordmark = "Stackivo",
}: StackivoLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <StackivoMark variant={variant} />
      {!iconOnly && (
        <StackivoWordmark text={wordmark} className="text-sm" />
      )}
    </span>
  );
}

/**
 * Hardcoded SVG string used by server-side renderers (PDF brand fallback,
 * email envelope, OG image generators) where React isn't available.
 */
export function stackivoMarkSvgString(opts?: {
  fill?: string;
  barFill?: string;
  size?: number;
}): string {
  const size = opts?.size ?? 64;
  const barFill = opts?.barFill ?? "#FFFFFF";
  const containerFill = opts?.fill ?? `url(#stk-${size})`;
  const gradient = opts?.fill
    ? ""
    : `<defs><linearGradient id="stk-${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${BRAND_PRIMARY}"/><stop offset="100%" stop-color="${BRAND_ACCENT}"/></linearGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${gradient}<rect x="0" y="0" width="512" height="512" rx="113" fill="${containerFill}"/><rect x="88" y="96" width="336" height="68" rx="34" fill="${barFill}"/><rect x="88" y="228" width="242" height="68" rx="34" fill="${barFill}" opacity="0.72"/><rect x="88" y="360" width="158" height="68" rx="34" fill="${barFill}" opacity="0.40"/></svg>`;
}
