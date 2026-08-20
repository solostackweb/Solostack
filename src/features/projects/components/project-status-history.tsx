import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProjectStatusHistoryEntry } from "../server";
import { PROJECT_STATUS_CONFIG } from "../status";

/**
 * Vertical timeline of status transitions. Server-rendered — receives the
 * entries from `listProjectStatusHistory` already shaped for display.
 *
 * Intentionally minimal: no pagination, no filters. The detail page caps
 * the list to 50 rows (server-side), and an "older transitions" affordance
 * can be added if real usage demands it.
 */
export function ProjectStatusHistory({
  entries,
  className,
}: {
  entries: ProjectStatusHistoryEntry[];
  className?: string;
}) {
  if (entries.length === 0) {
    return (
      <p
        className={cn(
          "rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground",
          className,
        )}
      >
        No status changes yet.
      </p>
    );
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {entries.map((entry) => {
        const toCfg = PROJECT_STATUS_CONFIG[entry.toStatus];
        const fromCfg = entry.fromStatus
          ? PROJECT_STATUS_CONFIG[entry.fromStatus]
          : null;
        const when = new Date(entry.createdAt);
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background",
                  toCfg.chipClass,
                )}
              >
                {fromCfg ? (
                  <span className={cn("h-2 w-2 rounded-full", toCfg.dotClass)} />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
              </span>
              <span className="mt-1 w-px flex-1 bg-border last:hidden" />
            </div>
            <div className="min-w-0 flex-1 pb-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {fromCfg ? (
                  <>
                    <span className="font-medium text-muted-foreground">
                      {fromCfg.label}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">{toCfg.label}</span>
                  </>
                ) : (
                  <span className="font-semibold">{toCfg.label}</span>
                )}
                <span className="ml-auto text-micro text-muted-foreground tabular-nums">
                  {when.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year:
                      when.getFullYear() === new Date().getFullYear()
                        ? undefined
                        : "numeric",
                  })}{" "}
                  &middot;{" "}
                  {when.toLocaleTimeString("en-IN", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {entry.note && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {entry.note}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
