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
  draft: "border-border bg-muted/70 text-muted-foreground",
  sent: "border-primary/20 bg-primary/10 text-primary",
  viewed: "border-primary/20 bg-primary/10 text-primary",
  paid: "border-success-subtle bg-success-subtle text-success-strong",
  overdue: "border-destructive/20 bg-destructive/10 text-destructive",
  partially_paid: "border-warning-subtle bg-warning-subtle text-warning-strong",
  cancelled: "border-border bg-muted/70 text-muted-foreground line-through",
};

const STATUS_DOT: Record<InvoiceStatusRow, string> = {
  draft: "bg-muted-foreground/60",
  sent: "bg-primary",
  viewed: "bg-primary",
  paid: "bg-success",
  overdue: "bg-destructive",
  partially_paid: "bg-warning",
  cancelled: "bg-muted-foreground/40",
};

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatusRow;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {INVOICE_STATUS_LABEL[status]}
    </span>
  );
}
