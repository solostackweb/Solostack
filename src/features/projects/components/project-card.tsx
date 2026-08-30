"use client";

import * as React from "react";
import Link from "next/link";
import { Calendar, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { ProjectRecord } from "../server";
import { ProjectStatusChip } from "./project-status-chip";

interface ProjectCardProps {
  project: ProjectRecord;
  /**
   * Optional client name for the given `project.clientId` — looked up in
   * the parent. Keeps this card pure/presentational.
   */
  clientName?: string | null;
  className?: string;
  /** Compact variant used inside the kanban column. */
  variant?: "grid" | "kanban";
  /** Selection state for the bulk-actions toolbar. */
  selected?: boolean;
  /** Called when the selection checkbox flips. */
  onSelectedChange?: (next: boolean) => void;
  /** Render the selection checkbox — hidden by default to keep the card clean. */
  selectable?: boolean;
}

/**
 * Reusable project card. Works both in the grid view (full, richer footer)
 * and in the kanban column (denser).
 */
export function ProjectCard({
  project,
  clientName,
  className,
  variant = "grid",
  selected,
  onSelectedChange,
  selectable,
}: ProjectCardProps) {
  const dueLabel = project.dueDate
    ? new Date(project.dueDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : "No due date";

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group block min-w-0 focus:outline-none"
      draggable={false}
    >
      <Card
        className={cn(
          "h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/20 group-hover:shadow-lg group-hover:shadow-primary/[0.05] group-focus-visible:ring-2 group-focus-visible:ring-ring",
          className,
        )}
      >
        <CardContent
          className={cn(
            "flex h-full flex-col gap-3",
            variant === "grid" ? "p-5" : "p-4",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <ProjectStatusChip
                  projectId={project.id}
                  status={project.status}
                  size={variant === "kanban" ? "sm" : "md"}
                />
              </div>
              <h3 className="mt-2.5 truncate text-sm font-bold tracking-tight transition-colors group-hover:text-primary">
                {project.name}
              </h3>
              {clientName ? (
                <p className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {clientName}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  No client assigned
                </p>
              )}
            </div>
            {selectable && (
              <div
                className="pt-0.5"
                onClick={(e) => {
                  // Prevent the outer Link from following the navigation
                  // when the user is just toggling the selection.
                  e.stopPropagation();
                  e.preventDefault();
                }}
              >
                <Checkbox
                  checked={!!selected}
                  onCheckedChange={(v) => onSelectedChange?.(v === true)}
                  aria-label="Select project"
                />
              </div>
            )}
          </div>

          {variant === "grid" && project.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {project.description}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Created{" "}
              {new Date(project.createdAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
              })}
            </span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="h-3 w-3" />
              {dueLabel}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
