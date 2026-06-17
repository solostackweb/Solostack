import * as React from "react";
import { cn } from "@/lib/utils";
import type { InvoiceStatusRow } from "@/lib/supabase/types";

/**
 * Display-friendly status tone + label for the real DB invoice statuses.
 * Unknown/legacy values fall back to the neutral "draft" styling so the
 * widget never crashes on a status it hasn't seen before.
 */
const STATUS_STYLES: Record<InvoiceStatusRow, string> = {
  draft: "bg-muted text-muted-foreground ring-border",
  sent: "bg-primary/10 text-primary ring-primary/20",
  viewed: "bg-primary/10 text-primary ring-primary/20",
  partially_paid: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
  paid: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelled: "bg-muted text-muted-foreground ring-border line-through",
};

const STATUS_DOT: Record<InvoiceStatusRow, string> = {
  draft: "bg-muted-foreground/60",
  sent: "bg-primary",
  viewed: "bg-primary",
  partially_paid: "bg-amber-500",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  cancelled: "bg-muted-foreground/40",
};

const STATUS_LABEL: Record<InvoiceStatusRow, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
  className,
}: {
  status: InvoiceStatusRow;
  className?: string;
}) {
  const tone = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const dot = STATUS_DOT[status] ?? STATUS_DOT.draft;
  const label = STATUS_LABEL[status] ?? status;
  const isLive = status === "sent" || status === "viewed" || status === "overdue";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isLive ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              dot,
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dot)} />
      </span>
      {label}
    </span>
  );
}
