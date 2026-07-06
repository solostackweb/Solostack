import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-[220px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-card/50 p-8 text-center sm:min-h-[300px] sm:p-10",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent_70%)]"
      />
      {Icon ? (
        <div className="relative mb-5">
          <span
            aria-hidden
            className="absolute inset-0 -m-1 rounded-2xl bg-primary/10 blur-xl"
          />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-indigo-500/15 text-primary ring-1 ring-primary/20">
            <Icon className="h-6 w-6" />
          </div>
        </div>
      ) : null}
      <h3 className="text-lg font-bold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {secondaryAction ? (
            secondaryAction.href ? (
              <Button asChild size="sm" variant="outline">
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          ) : null}
          {action ? (
            action.href ? (
              <Button
                asChild
                size="sm"
                className="font-semibold shadow-md shadow-primary/15 transition-shadow hover:shadow-lg hover:shadow-primary/25"
              >
                <a href={action.href}>{action.label}</a>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={action.onClick}
                className="font-semibold shadow-md shadow-primary/15 transition-shadow hover:shadow-lg hover:shadow-primary/25"
              >
                {action.label}
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
