/**
 * Admin Design-System Kit
 * ------------------------
 * Shared, presentational primitives for every admin route. This is the single
 * source of truth for the founder console's look - modern and spacious, but
 * still dense enough for an operating tool. Pages compose these instead of
 * hand-rolling their own Panel / Stat / grid markup.
 *
 * Design tokens baked in here:
 *   - Surfaces: rounded-lg, border, bg-card, soft ring-shadow elevation.
 *   - Rhythm: 8pt spacing scale (gap-3/4/5, p-5/6), generous section gaps.
 *   - Numbers: tabular-nums everywhere data appears.
 *   - Tone: neutral | ok | warn | alert | info - a tiny, disciplined palette.
 *     Green = good & worth celebrating, amber = watch, red = act, blue = info.
 *
 * All components are server-safe (no hooks / client APIs) so they can be used
 * from server and client components alike.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "ok" | "warn" | "alert" | "info";

type IconType = React.ComponentType<{ className?: string }>;

// ---------------------------------------------------------------------------
// Tone tokens - one place to tune the whole palette.
// ---------------------------------------------------------------------------

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  ok: "text-success-strong",
  warn: "text-warning-strong",
  alert: "text-destructive-strong",
  info: "text-info-strong",
};

const TONE_CHIP: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-success-subtle text-success-strong",
  warn: "bg-warning-subtle text-warning-strong",
  alert: "bg-destructive-subtle text-destructive-strong",
  info: "bg-info-subtle text-info-strong",
};

const TONE_SURFACE: Record<Tone, string> = {
  neutral: "",
  ok: "border-success-subtle bg-success/[0.045]",
  warn: "border-warning-subtle bg-warning/[0.045]",
  alert: "border-destructive-subtle bg-destructive/[0.045]",
  info: "border-info-subtle bg-info/[0.045]",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground/50",
  ok: "bg-success",
  warn: "bg-warning",
  alert: "bg-destructive",
  info: "bg-info",
};

// Shared elevation for resting surfaces.
const SURFACE =
  "rounded-lg border bg-card/95 shadow-sm shadow-black/[0.035] dark:bg-card dark:shadow-black/25";

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Page-level vertical rhythm wrapper. Replaces ad-hoc `space-y-6`. */
export function AdminSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-5 sm:space-y-6", className)}>{children}</div>;
}

/**
 * Responsive grid for KPI/stat tiles. `cols` is the desktop column count;
 * it always collapses to 2 on small screens then steps up.
 */
export function KpiGrid({
  children,
  cols = 4,
  className,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}) {
  const lg: Record<number, string> = {
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
  };
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:auto-rows-fr",
        lg[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel - the workhorse surface.
// ---------------------------------------------------------------------------

export function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  tone = "neutral",
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: IconType;
  action?: ReactNode;
  tone?: Tone;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const hasHeader = title || subtitle || action || Icon;
  return (
    <section className={cn(SURFACE, "p-5 sm:p-6", TONE_SURFACE[tone], className)}>
      {hasHeader ? (
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  TONE_CHIP[tone === "neutral" ? "info" : tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              {title ? (
                <h2 className="truncate text-sm font-semibold tracking-tight sm:text-sm">
                  {title}
                </h2>
              ) : null}
              {subtitle ? (
                <p className="text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** A subdued inner block for nesting inside a Panel. */
export function Block({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-background/50 p-4",
        TONE_SURFACE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard - the flagship KPI tile (modern & spacious).
// ---------------------------------------------------------------------------

export interface StatDelta {
  /** e.g. "+12%", "+₹1,200". */
  label: ReactNode;
  /** up = good by default; pass tone to override coloring. */
  direction?: "up" | "down" | "flat";
  tone?: Tone;
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
  tone = "neutral",
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  delta?: StatDelta;
  icon?: IconType;
  tone?: Tone;
  href?: string;
  className?: string;
}) {
  const DeltaIcon =
    delta?.direction === "down"
      ? ArrowDownRight
      : delta?.direction === "flat"
        ? ArrowRight
        : ArrowUpRight;
  const deltaTone: Tone =
    delta?.tone ??
    (delta?.direction === "down"
      ? "alert"
      : delta?.direction === "flat"
        ? "neutral"
        : "ok");

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              TONE_CHIP[tone === "neutral" ? "info" : tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold leading-none tracking-tight tabular-nums sm:text-3xl">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
              TONE_TEXT[deltaTone],
            )}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta.label}
          </span>
        ) : null}
        {hint ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {hint}
          </span>
        ) : null}
      </div>
    </>
  );

  const base = cn(
    SURFACE,
    "min-h-[132px] p-5 transition",
    TONE_SURFACE[tone],
    href && "hover:border-foreground/15 hover:shadow-md",
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          base,
          "group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}

// ---------------------------------------------------------------------------
// Badge / Pill
// ---------------------------------------------------------------------------

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-micro font-medium",
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ToneDot({ tone = "neutral" }: { tone?: Tone }) {
  return <span className={cn("h-2 w-2 rounded-full", TONE_DOT[tone])} />;
}

// ---------------------------------------------------------------------------
// Definition rows + metric lists
// ---------------------------------------------------------------------------

export function DataRow({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

/** A titled list of label/value pairs - replaces the old MetricCard. */
export function MetricList({
  title,
  icon: Icon,
  items,
  className,
}: {
  title: ReactNode;
  icon?: IconType;
  items: Array<[ReactNode, ReactNode]>;
  className?: string;
}) {
  return (
    <div className={cn(SURFACE, "p-4", className)}>
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-3.5 w-3.5 text-muted-foreground" /> : null}
        <h3 className="text-xs font-semibold">{title}</h3>
      </div>
      <dl className="mt-3 space-y-2">
        {items.map(([label, value], i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: IconType;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-background/40 px-4 py-8 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-6 w-6 text-muted-foreground/60" /> : null}
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      {children ? (
        <p className="max-w-sm text-xs text-muted-foreground">{children}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

export function AdminTableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card/95 shadow-sm shadow-black/[0.035] dark:bg-card dark:shadow-black/25",
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function AdminTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <table className={cn("min-w-full text-sm", className)}>{children}</table>;
}

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/45 text-left text-micro uppercase tracking-wider text-muted-foreground">
      {children}
    </thead>
  );
}

export function AdminTh({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={cn("px-3 py-2.5 font-medium", className)}>{children}</th>;
}

export function AdminTr({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-t border-border/45 transition-colors hover:bg-accent/30",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function AdminTd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-2.5 align-middle", className)}>{children}</td>;
}

// ---------------------------------------------------------------------------
// Link helpers
// ---------------------------------------------------------------------------

/** Subtle "see more ->" link used in panel headers. */
export function PanelLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}
