import * as React from "react";
import { cn } from "@/lib/utils";
import type { ContractStatusRow } from "@/lib/supabase/types";
import { CONTRACT_STATUS_LABEL } from "../status";

const STATUS_STYLES: Record<ContractStatusRow, string> = {
  draft: "border-border bg-muted/70 text-muted-foreground",
  sent: "border-primary/20 bg-primary/10 text-primary",
  viewed: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  signed: "border-success-subtle bg-success-subtle text-success-strong",
  declined: "border-destructive/20 bg-destructive/10 text-destructive",
  expired: "border-warning-subtle bg-warning-subtle text-warning-strong",
};

const STATUS_DOT: Record<ContractStatusRow, string> = {
  draft: "bg-muted-foreground/60",
  sent: "bg-primary",
  viewed: "bg-violet-500",
  signed: "bg-success",
  declined: "bg-destructive",
  expired: "bg-warning",
};

export function ContractStatusBadge({
  status,
  className,
}: {
  status: ContractStatusRow;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {CONTRACT_STATUS_LABEL[status]}
    </span>
  );
}
