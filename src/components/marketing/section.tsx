import * as React from "react";
import { cn } from "@/lib/utils";

/** Calm Command marketing rhythm and composition primitives. */

const SIZE_CLASSES = {
  /** Readable prose and text-led sections. */
  default: "max-w-7xl",
  /** Visual-heavy sections — documents, tables, mockups. */
  wide: "max-w-[1400px]",
  /** Cinematic / full-bleed compositions. */
  ultra: "max-w-[1440px]",
  /** No max width; the caller handles it. */
  full: "max-w-none",
} as const;

const HORIZONTAL_PADDING = "px-5 sm:px-8 lg:px-10 xl:px-14 2xl:px-20";

const VERTICAL_PADDING = "py-20 sm:py-24 lg:py-28 xl:py-[120px]";

export function Section({
  children,
  id,
  className,
  bleed = false,
  size = "default",
  /** Draws the hairline that separates this section from the one above. */
  rule = false,
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  bleed?: boolean;
  size?: keyof typeof SIZE_CLASSES;
  rule?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full scroll-mt-24",
        rule && "border-t border-border",
        !bleed && VERTICAL_PADDING,
        className,
      )}
    >
      <div className={cn("mx-auto w-full", SIZE_CLASSES[size], HORIZONTAL_PADDING)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Full-bleed deep-blue band for one decisive change of pace.
 */
export function SectionBand({
  children,
  id,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <section id={id} className={cn("relative w-full scroll-mt-24 bg-foreground py-16 text-background sm:py-20", className)}>
      <div className={cn("mx-auto w-full", SIZE_CLASSES[size], HORIZONTAL_PADDING)}>
        {children}
      </div>
    </section>
  );
}

/**
 * A mono label with a hairline extension. It echoes the Flowline without
 * turning every heading into a badge.
 */
export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 font-mono text-micro font-medium uppercase tracking-[0.14em] text-primary",
        className,
      )}
    >
      {children}
      <span aria-hidden className="h-px flex-1 bg-primary/25" />
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  /** MASTER.md §8: left is the default. Centre is the exception. */
  align = "left",
  size = "default",
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  /** `large` bumps one step — landing and pricing intros only. */
  size?: "default" | "large";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col",
        align === "center" ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl items-start text-left",
        className,
      )}
    >
      {eyebrow ? (
        <SectionEyebrow className={cn("mb-6 w-full", align === "center" && "justify-center")}>
          {eyebrow}
        </SectionEyebrow>
      ) : null}

      <h2
        className={cn(
          "text-balance font-display font-semibold tracking-[-0.045em] text-foreground",
          size === "large" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-5xl",
        )}
      >
        {title}
      </h2>

      {subtitle ? (
        <p className="mt-5 max-w-[60ch] text-pretty text-base leading-[1.7] text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Column set separated by hairlines rather than repeated generic cards.
 */
export function RuledColumns({
  children,
  className,
  cols = 3,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 2 | 3 | 4;
}) {
  return (
    <div
      className={cn(
        "grid border-t border-border",
        cols === 2 && "sm:grid-cols-2",
        cols === 3 && "sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function RuledColumn({
  index,
  title,
  children,
  className,
}: {
  /** Rendered as the mono ordinal above the title. */
  index?: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "border-b border-border py-8 pr-8 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:[&:not(:first-child)]:pl-8",
        className,
      )}
    >
      {index ? (
        <p className="mb-4 font-mono text-micro uppercase tracking-[0.16em] text-primary">{index}</p>
      ) : null}
      <h3 className="font-display text-xl font-semibold leading-tight tracking-[-0.035em] text-foreground sm:text-2xl">
        {title}
      </h3>
      <div className="mt-3 max-w-[46ch] text-sm leading-[1.7] text-muted-foreground sm:text-base">
        {children}
      </div>
    </article>
  );
}

/**
 * Crisp artifact surface. Use for documents that need to read as real output.
 */
export function Paper({
  children,
  className,
  offset = true,
}: {
  children: React.ReactNode;
  className?: string;
  offset?: boolean;
}) {
  return (
    <div className="relative">
      {offset ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 translate-x-3 translate-y-3 rounded-2xl bg-accent/55"
        />
      ) : null}
      <div className={cn("relative rounded-2xl border border-border bg-card", className)}>{children}</div>
    </div>
  );
}
