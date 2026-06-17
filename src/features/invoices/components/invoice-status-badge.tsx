import * as React from "react";
import { cn } from "@/lib/utils";
import type { InvoiceStatusRow } from "@/lib/supabase/types";
import { INVOICE_STATUS_LABEL } from "../status";

/**
 * Reusable badge system keyed off {@link InvoiceStatusRow}.
 *
 * Each status maps to a pair of (bg + text) Tailwind tokens so the palette
 * stays consistent across the table, profile pages, and activity timeline.
 */
const STATUS_STYLES: Record<InvoiceStatusRow, string> = {
  draft: "bg-muted text-muted-foreground ring-border",
  sent: "bg-primary/10 text-primary ring-primary/20",
  viewed: "bg-primary/10 text-primary ring-primary/20",
  paid: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
  overdue: "bg-destructive/10 text-destructive ring-destructive/20",
  partially_paid: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
  cancelled: "bg-muted text-muted-foreground ring-border line-through",
};

const STATUS_DOT: Record<InvoiceStatusRow, string> = {
  draft: "bg-muted-foreground/60",
  sent: "bg-primary",
  viewed: "bg-primary",
  paid: "bg-emerald-500",
  overdue: "bg-destructive",
  partially_paid: "bg-amber-500",
  cancelled: "bg-muted-foreground/40",
};

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatusRow;
  className?: string;
}) {
  const isLive = status === "sent" || status === "viewed" || status === "overdue";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset whitespace-nowrap",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isLive ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              STATUS_DOT[status],
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      </span>
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
