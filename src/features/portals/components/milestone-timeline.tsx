"use client";

/**
 * Milestone timeline — a vertical, branded progress view built from portal
 * updates. Pure presentational; mobile-first. No new data or infra.
 */

import * as React from "react";
import {
  CheckCircle2, Circle, Flag, Package, FileEdit, CreditCard, Video, Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { PortalUpdateRow, PortalUpdateType } from "@/lib/supabase/types";

type TimelineUpdate = PortalUpdateRow & {
  author: { full_name: string | null; email: string | null } | null;
};

const TYPE_ICON: Record<PortalUpdateType, LucideIcon> = {
  progress: Circle,
  deliverable: Package,
  revision: FileEdit,
  payment: CreditCard,
  milestone: Flag,
  meeting: Video,
  general: Megaphone,
};

const TYPE_DOT: Record<PortalUpdateType, string> = {
  progress: "text-info-strong",
  deliverable: "text-violet-500",
  revision: "text-warning-strong",
  payment: "text-success-strong",
  milestone: "text-orange-500",
  meeting: "text-blue-500",
  general: "text-muted-foreground",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MilestoneTimeline({
  updates,
  brandColor,
}: {
  updates: TimelineUpdate[];
  brandColor?: string;
}) {
  // Chronological — oldest first reads like a project story.
  const ordered = React.useMemo(
    () => [...updates].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)),
    [updates],
  );

  if (ordered.length === 0) return null;

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Project timeline</h2>
      <ol className="mt-4 space-y-0">
        {ordered.map((u, i) => {
          const Icon = TYPE_ICON[u.update_type] ?? Circle;
          const dot = TYPE_DOT[u.update_type] ?? "text-muted-foreground";
          const approved = u.approval_status === "approved";
          const last = i === ordered.length - 1;
          return (
            <li key={u.id} className="relative flex gap-3 pb-5 last:pb-0">
              {/* Rail */}
              {!last && (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-px bg-border"
                  aria-hidden
                />
              )}
              {/* Node */}
              <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                {approved ? (
                  <CheckCircle2 className="h-5 w-5 text-success-strong" />
                ) : (
                  <Icon className={`h-5 w-5 ${dot}`} />
                )}
              </span>
              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-sm font-medium leading-snug">{u.title}</p>
                  {approved && (
                    <span className="rounded-full bg-success-subtle px-1.5 py-0.5 text-micro font-semibold text-success-strong">
                      Approved
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-micro capitalize text-muted-foreground">
                  {u.update_type} · {fmt(u.created_at)}
                </p>
                {u.body && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{u.body}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {brandColor ? <span className="hidden" style={{ color: brandColor }} /> : null}
    </section>
  );
}
