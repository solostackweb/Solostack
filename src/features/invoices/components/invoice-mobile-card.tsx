"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { InvoiceRecord } from "../server";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { SwipeRow, type SwipeAction } from "@/components/ui/swipe-row";

interface InvoiceMobileCardProps {
  invoice: InvoiceRecord;
  clientName: string | null;
  isSelected: boolean;
  onToggleSelected: () => void;
  onOpen: () => void;
  onMarkPaid: () => void;
  onDelete: () => void;
  /** When true, leading checkbox is shown for bulk selection. */
  showCheckbox?: boolean;
}

/**
 * Compute a friendly due-state label and tone — mirrors the desktop cell so
 * mobile shows identical urgency cues.
 */
function dueLabel(invoice: InvoiceRecord) {
  const now = new Date();
  if (invoice.status === "paid") {
    if (!invoice.paidAt) return { label: "Paid", tone: "muted" as const };
    const days = Math.round(
      (now.getTime() - new Date(invoice.paidAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days === 0) return { label: "Paid today", tone: "muted" as const };
    if (days === 1) return { label: "Paid yesterday", tone: "muted" as const };
    return { label: `Paid ${days}d ago`, tone: "muted" as const };
  }
  if (invoice.status === "draft") {
    return { label: "Not sent", tone: "muted" as const };
  }
  if (!invoice.dueDate) return { label: "No due date", tone: "muted" as const };
  const diff = Math.round(
    (new Date(invoice.dueDate).getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  if (diff < 0) {
    return { label: `Overdue ${Math.abs(diff)}d`, tone: "danger" as const };
  }
  if (diff === 0) return { label: "Due today", tone: "warning" as const };
  if (diff <= 3) return { label: `Due in ${diff}d`, tone: "warning" as const };
  return { label: `Due in ${diff}d`, tone: "muted" as const };
}

export function InvoiceMobileCard({
  invoice,
  clientName,
  isSelected,
  onToggleSelected,
  onOpen,
  onMarkPaid,
  onDelete,
  showCheckbox = false,
}: InvoiceMobileCardProps) {
  const due = dueLabel(invoice);
  const issued = new Date(invoice.issueDate).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
  const canMarkPaid = invoice.status !== "paid";

  const swipeActions: SwipeAction[] = [
    ...(canMarkPaid
      ? [{ label: "Paid", icon: CheckCircle2, onClick: onMarkPaid }]
      : []),
    { label: "Delete", icon: Trash2, onClick: onDelete, destructive: true },
  ];

  return (
    <SwipeRow actions={swipeActions} className="rounded-lg">
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "tap-scale group relative flex w-full flex-col gap-2 rounded-lg border bg-card p-3.5 text-left shadow-sm transition-colors active:bg-muted/40",
        isSelected && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center pt-0.5"
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={onToggleSelected}
              aria-label={`Select invoice ${invoice.invoiceNumber}`}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold leading-tight">
              {invoice.invoiceNumber}
            </p>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {clientName ?? "—"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="text-sm font-semibold tabular-nums leading-tight">
            {formatMoney(Number(invoice.totalAmount) || 0, invoice.currency)}
          </div>
          {invoice.taxTotal > 0 && (
            <div className="text-xs tabular-nums text-muted-foreground">
              incl. {formatMoney(Number(invoice.taxTotal) || 0, invoice.currency)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Issued {issued}</span>
          <span aria-hidden>·</span>
          <span
            className={cn(
              "font-medium",
              due.tone === "danger" && "text-destructive",
              due.tone === "warning" && "text-warning",
              due.tone === "muted" && "text-muted-foreground",
            )}
          >
            {due.label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground"
                aria-label="Invoice actions"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/invoices/${invoice.id}`}>
                  <Eye className="h-3.5 w-3.5" /> View
                </Link>
              </DropdownMenuItem>
              {canMarkPaid && (
                <DropdownMenuItem onClick={onMarkPaid}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as paid
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ChevronRight
            className="h-4 w-4 text-muted-foreground/60"
            aria-hidden
          />
        </div>
      </div>
    </div>
    </SwipeRow>
  );
}
