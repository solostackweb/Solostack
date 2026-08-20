"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProjectStatusRow } from "@/lib/supabase/types";
import { PROJECT_STATUSES, PROJECT_STATUS_CONFIG } from "../status";
import { bulkChangeProjectStatusAction } from "../actions";

interface ProjectsBulkBarProps {
  selectedIds: string[];
  onClear: () => void;
  className?: string;
}

/**
 * Bottom-anchored sticky toolbar that appears whenever the user has
 * selected one or more projects via the card checkboxes.
 *
 * Intentionally lightweight — just "change status" today. New batch
 * actions (assign client, set due date) can drop in alongside the
 * existing dropdown without restructuring.
 *
 * Renders nothing when `selectedIds` is empty so it stays out of the
 * accessibility tree and consumes no layout space.
 */
export function ProjectsBulkBar({
  selectedIds,
  onClear,
  className,
}: ProjectsBulkBarProps) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  if (selectedIds.length === 0) return null;

  const applyStatus = (status: ProjectStatusRow) => {
    startTransition(async () => {
      const res = await bulkChangeProjectStatusAction({
        ids: selectedIds,
        status,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const outcome = res.data;
      if (!outcome) {
        toast.success(res.message ?? "Updated.");
      } else if (outcome.failureCount === 0) {
        toast.success(`Moved ${outcome.successCount} to ${PROJECT_STATUS_CONFIG[status].label}.`);
      } else {
        toast.warning(
          `${outcome.successCount} updated · ${outcome.failureCount} failed.`,
        );
      }
      onClear();
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        // Fixed at the bottom on mobile, floats centered on desktop.
        "pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6",
        className,
      )}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border bg-background/95 px-2 py-1.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:gap-3 sm:px-3">
        <div className="flex items-center gap-2 px-2">
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-1.5 text-micro font-semibold tabular-nums text-primary-foreground">
            {selectedIds.length}
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
            selected
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={pending}>
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Change status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" side="top" className="w-64">
            <DropdownMenuLabel className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
              Move all to&hellip;
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PROJECT_STATUSES.map((s) => {
              const cfg = PROJECT_STATUS_CONFIG[s];
              return (
                <DropdownMenuItem
                  key={s}
                  onSelect={(e) => {
                    e.preventDefault();
                    applyStatus(s);
                  }}
                  className="cursor-pointer items-start gap-2.5 py-2"
                >
                  <span
                    className={cn(
                      "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                      cfg.dotClass,
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium">
                      {cfg.label}
                    </span>
                    <span className="block text-micro text-muted-foreground">
                      {cfg.description}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onClear}
          disabled={pending}
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
