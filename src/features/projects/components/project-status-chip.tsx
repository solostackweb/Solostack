"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ProjectStatusRow } from "@/lib/supabase/types";
import { PROJECT_STATUSES, PROJECT_STATUS_CONFIG } from "../status";
import { changeProjectStatusAction } from "../actions";

interface ProjectStatusChipProps {
  projectId: string;
  status: ProjectStatusRow;
  /** Visual size — `sm` for kanban cards, `md` (default) elsewhere. */
  size?: "sm" | "md";
  /** Fired after a successful change so the parent can refresh / animate. */
  onChanged?: (next: ProjectStatusRow) => void;
  /** Disable the dropdown (e.g. when the caller is not the owner). */
  readOnly?: boolean;
  className?: string;
}

/**
 * Click-to-change status chip. The canonical, mobile-friendly way to
 * mutate a project's lifecycle state.
 *
 * UX guarantees:
 *   • Optimistic update — the chip switches the moment the user picks a
 *     new status; if the server rejects, we revert and surface a toast.
 *   • Loading affordance — a tiny inline spinner during the in-flight call
 *     keeps the chip's footprint stable (no layout shift).
 *   • Stop-propagation on every interactive surface — safe to embed
 *     inside `<Link>`-wrapped cards on the projects list.
 *   • Touch target — the picker rows are sized for thumbs (44px+ on mobile).
 */
export function ProjectStatusChip({
  projectId,
  status,
  size = "md",
  onChanged,
  readOnly,
  className,
}: ProjectStatusChipProps) {
  // `displayed` is the optimistic state we paint immediately; we only
  // commit it after the server confirms (or revert on failure).
  const [displayed, setDisplayed] = React.useState<ProjectStatusRow>(status);
  const [pending, startTransition] = React.useTransition();

  // Keep `displayed` in sync if the server pushes a fresh snapshot down
  // (e.g. after revalidatePath on the parent).
  React.useEffect(() => {
    setDisplayed(status);
  }, [status]);

  const cfg = PROJECT_STATUS_CONFIG[displayed];

  const change = (next: ProjectStatusRow) => {
    if (next === displayed) return;
    const previous = displayed;
    setDisplayed(next);
    startTransition(async () => {
      const res = await changeProjectStatusAction({ id: projectId, status: next });
      if (!res.ok) {
        setDisplayed(previous);
        toast.error(res.error);
        return;
      }
      toast.success(`Moved to ${PROJECT_STATUS_CONFIG[next].label}`);
      onChanged?.(next);
    });
  };

  // Read-only mode: render the static badge with no dropdown affordance.
  if (readOnly) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
          size === "md" && "px-2.5",
          cfg.chipClass,
          className,
        )}
      >
        <Dot dotClass={cfg.dotClass} pulse={!!cfg.pulse} />
        {cfg.label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            // The chip is often embedded inside a <Link>; stop the click
            // bubbling so opening the menu doesn't navigate.
            e.stopPropagation();
            e.preventDefault();
          }}
          aria-label={`Change status. Currently ${cfg.label}.`}
          className={cn(
            "group inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 text-xs font-medium ring-1 ring-inset transition-all hover:ring-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
            size === "sm"
              ? "px-2"
              : "px-2.5",
            cfg.chipClass,
            className,
          )}
        >
          <Dot dotClass={cfg.dotClass} pulse={!!cfg.pulse} />
          <span>{cfg.label}</span>
          {pending ? (
            <Loader2 className="h-3 w-3 animate-spin opacity-70" />
          ) : (
            <ChevronDown className="h-3 w-3 opacity-50 transition-transform group-data-[state=open]:rotate-180" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DropdownMenuLabel className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Change status
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PROJECT_STATUSES.map((s) => {
          const itemCfg = PROJECT_STATUS_CONFIG[s];
          const isCurrent = s === displayed;
          return (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => {
                e.preventDefault();
                change(s);
              }}
              className="cursor-pointer items-start gap-2.5 py-2"
            >
              <span className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full ring-2 ring-background">
                <span
                  className={cn("inline-block h-2 w-2 rounded-full", itemCfg.dotClass)}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium">
                  {itemCfg.label}
                </span>
                <span className="block text-micro text-muted-foreground">
                  {itemCfg.description}
                </span>
              </span>
              {isCurrent && (
                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Dot({ dotClass, pulse }: { dotClass: string; pulse: boolean }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            dotClass,
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-1.5 w-1.5 rounded-full",
          dotClass,
        )}
      />
    </span>
  );
}
