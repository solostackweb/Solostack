/**
 * Single-metric tile used across the Now page and resource pages.
 *
 *   <Stat label="MRR" value="₹12,400" hint="Δ +₹1,200 wk" tone="ok" />
 *
 * `tone` drives a tiny coloured accent (left border + label colour).
 * Defaults to neutral. Never spam tones - green is for "ok and worth
 * celebrating", amber for "warn", red for "alert."
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "ok" | "warn" | "alert";

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
}

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: "border-l-border",
  ok: "border-l-emerald-500/70",
  warn: "border-l-amber-500/70",
  alert: "border-l-red-500/70",
};

const LABEL_TONE: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-success-strong",
  warn: "text-warning-strong",
  alert: "text-destructive-strong",
};

export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: StatProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-sm shadow-black/[0.03] px-4 py-3 border-l-4",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <div
        className={cn(
          "text-micro font-medium uppercase tracking-wider",
          LABEL_TONE[tone],
        )}
      >
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-micro text-muted-foreground tabular-nums">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
