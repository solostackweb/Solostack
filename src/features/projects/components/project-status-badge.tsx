import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProjectStatusRow } from "@/lib/supabase/types";
import { PROJECT_STATUS_CONFIG } from "../status";

/**
 * Read-only chip. For the interactive picker that triggers status
 * mutations, use `ProjectStatusChip` instead — it composes this badge.
 *
 * Adding a new status only requires an entry in `PROJECT_STATUS_CONFIG`;
 * this component reads everything from there.
 */
export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatusRow;
  className?: string;
}) {
  const cfg = PROJECT_STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-semibold uppercase tracking-wider ring-1 ring-inset",
        cfg.chipClass,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {cfg.pulse ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              cfg.dotClass,
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            cfg.dotClass,
          )}
        />
      </span>
      {cfg.label}
    </span>
  );
}
