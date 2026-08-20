import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-micro font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        // Tinted status pills. These are the shape the product actually
        // uses — 1,201 places were hand-rolling `bg-emerald-500/10
        // text-emerald-700` because the only variants available were solid
        // fills. Reach for these instead of writing the pair by hand.
        success: "border-transparent bg-success-subtle text-success-strong",
        warning: "border-transparent bg-warning-subtle text-warning-strong",
        info: "border-transparent bg-info-subtle text-info-strong",
        danger: "border-transparent bg-destructive-subtle text-destructive-strong",
        // Solid fills, for when a badge must carry weight (counts, alerts).
        successSolid: "border-transparent bg-success text-success-foreground",
        warningSolid: "border-transparent bg-warning text-warning-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
