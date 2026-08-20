import { cn } from "@/lib/utils";

/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * The shimmer uses a slightly wider gradient sweep (20% → 50% → 80%)
 * with a warmer highlight in light mode and a cooler one in dark mode,
 * giving a more polished, Linear-style feel over the default gray wash.
 *
 * All animation is GPU-only (transform). The `prefers-reduced-motion`
 * global rule in globals.css collapses the animation to ~0 ms, so the
 * skeleton still shows as a static placeholder without motion.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted/60",
        // Shimmer wave — wider gradient for a smoother, more premium sweep
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-shimmer",
        "before:bg-gradient-to-r",
        "before:from-transparent before:via-foreground/[0.05] before:to-transparent",
        "dark:before:via-foreground/[0.04]",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
