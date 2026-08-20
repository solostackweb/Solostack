import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Marketing container sizes.
 *
 *   default  — typical content (readable prose, cards)   max-w-7xl   (1280)
 *   wide     — visual-heavy sections (mockups, hero)     max-w-[1400px]
 *   ultra    — cinematic / full-bleed compositions       max-w-[1600px]
 *   full     — no max width, caller handles it
 */
const SIZE_CLASSES = {
  default: "max-w-7xl",
  wide: "max-w-[1400px]",
  ultra: "max-w-[1600px]",
  full: "max-w-none",
} as const;

/**
 * Horizontal padding scales with viewport — tight on phones, luxurious on
 * ultra-wide desktops. Using clamp-like step-ups keeps the content from
 * hugging the edges on 1440p / 4K screens.
 */
const HORIZONTAL_PADDING =
  "px-5 sm:px-8 lg:px-10 xl:px-14 2xl:px-20";

/**
 * Vertical spacing scales up more aggressively on large screens so the
 * rhythm feels cinematic rather than cramped.
 */
const VERTICAL_PADDING =
  "py-12 sm:py-14 lg:py-16";

export function Section({
  children,
  id,
  className,
  bleed = false,
  size = "default",
}: {
  children: React.ReactNode;
  id?: string;
  className?: string;
  bleed?: boolean;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative w-full",
        !bleed && VERTICAL_PADDING,
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto w-full",
          SIZE_CLASSES[size],
          HORIZONTAL_PADDING,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-micro font-semibold uppercase tracking-widest text-primary">
      <span className="h-1 w-1 rounded-full bg-primary/80" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  size = "default",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  /** `large` bumps the heading one step — used on landing/pricing intros. */
  size?: "default" | "large";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center"
          ? "mx-auto max-w-3xl items-center text-center"
          : "max-w-2xl items-start text-left",
      )}
    >
      {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
      <h2
        className={cn(
          "text-balance font-display font-semibold tracking-tight",
          size === "large"
            ? "text-3xl sm:text-4xl lg:text-5xl lg:tracking-[-0.02em]"
            : "text-2xl sm:text-3xl lg:text-4xl lg:tracking-[-0.018em]",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="text-pretty text-base leading-[1.75] text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
