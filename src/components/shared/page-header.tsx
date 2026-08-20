import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Tighter bottom padding on mobile so the header doesn't eat as
        // much of the visible viewport.
        "flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pb-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1 sm:space-y-1.5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl sm:leading-tight sm:tracking-[-0.02em]">
          {title}
        </h1>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground xs:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
