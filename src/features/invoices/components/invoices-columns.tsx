"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  MoreHorizontal,
  Eye,
  Trash2,
  Copy,
  Send,
  Pencil,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getClientInitials } from "@/features/clients/utils";

import type { InvoiceRecord } from "../server";
import { InvoiceStatusBadge } from "./invoice-status-badge";

export interface InvoiceColumnLookup {
  /** Display name keyed by client_id. Falls back to "Unknown" when missing. */
  clientNameById: Map<string, string>;
}

interface ColumnActions {
  onMarkPaid: (invoice: InvoiceRecord) => void;
  onDelete: (invoice: InvoiceRecord) => void;
  onCancel: (invoice: InvoiceRecord) => void;
  onDuplicate: (invoice: InvoiceRecord) => void;
  onResend: (invoice: InvoiceRecord) => void;
  lookup: InvoiceColumnLookup;
}

/**
 * Map a row's `due_date` + `status` to a friendly label & tone.
 * Overdue → red; due within 3d → amber; "paid X days ago" muted.
 */
function formatDueLabel(invoice: InvoiceRecord) {
  const now = new Date();

  if (invoice.status === "paid") {
    if (invoice.paidAt) {
      const paidAgo = Math.round(
        (now.getTime() - new Date(invoice.paidAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      if (paidAgo === 0) return { label: "Paid today", tone: "muted" as const };
      if (paidAgo === 1)
        return { label: "Paid yesterday", tone: "muted" as const };
      return { label: `Paid ${paidAgo}d ago`, tone: "muted" as const };
    }
    return { label: "Paid", tone: "muted" as const };
  }
  if (invoice.status === "draft") {
    return { label: "Not sent", tone: "muted" as const };
  }
  if (!invoice.dueDate) {
    return { label: "No due date", tone: "muted" as const };
  }
  const due = new Date(invoice.dueDate);
  const diffDays = Math.round(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays < 0) {
    return {
      label: `Overdue ${Math.abs(diffDays)}d`,
      tone: "danger" as const,
    };
  }
  if (diffDays === 0) return { label: "Due today", tone: "warning" as const };
  if (diffDays <= 3) return { label: `In ${diffDays}d`, tone: "warning" as const };
  return { label: `In ${diffDays}d`, tone: "muted" as const };
}

export function buildInvoiceColumns({
  onMarkPaid,
  onDelete,
  onCancel,
  onDuplicate,
  onResend,
  lookup,
}: ColumnActions): ColumnDef<InvoiceRecord>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
          className="translate-y-[1px]"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
          className="translate-y-[1px]"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "invoiceNumber",
      meta: { label: "Invoice #" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Invoice" />
      ),
      cell: ({ row }) => {
        const inv = row.original;
        const issued = new Date(inv.issueDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
        });
        return (
          <div className="min-w-[120px]">
            <Link
              href={`/dashboard/invoices/${inv.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium hover:underline"
            >
              {inv.invoiceNumber}
            </Link>
            <div className="text-xs text-muted-foreground">Issued {issued}</div>
          </div>
        );
      },
      filterFn: (row, _id, value) => {
        const q = String(value).toLowerCase();
        const inv = row.original;
        const clientName = inv.clientId
          ? (lookup.clientNameById.get(inv.clientId) ?? "")
          : "";
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          clientName.toLowerCase().includes(q)
        );
      },
    },
    {
      id: "clientId",
      accessorFn: (i) =>
        i.clientId ? (lookup.clientNameById.get(i.clientId) ?? "Unknown") : "—",
      meta: { label: "Client" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Client" />
      ),
      cell: ({ row }) => {
        const inv = row.original;
        const name = inv.clientId
          ? lookup.clientNameById.get(inv.clientId)
          : null;
        if (!name) {
          return <span className="text-sm text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] font-medium">
                {getClientInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{name}</span>
          </div>
        );
      },
      filterFn: (row, id, value) => {
        if (!value || value === "all") return true;
        return row.getValue(id) === value;
      },
    },
    {
      accessorKey: "status",
      meta: { label: "Status" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => {
        if (!value || value === "all") return true;
        if (Array.isArray(value)) {
          return value.length === 0 || value.includes(row.getValue(id));
        }
        return row.getValue(id) === value;
      },
    },
    {
      accessorKey: "totalAmount",
      meta: { label: "Amount" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" align="right" />
      ),
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="text-right">
            <div className="text-sm font-semibold tabular-nums">
              {formatINR(Number(inv.totalAmount) || 0)}
            </div>
            {inv.taxTotal > 0 && (
              <div className="text-[11px] tabular-nums text-muted-foreground">
                incl. {formatINR(Number(inv.taxTotal) || 0)} GST
              </div>
            )}
          </div>
        );
      },
      sortingFn: "basic",
    },
    {
      accessorKey: "dueDate",
      meta: { label: "Due" },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Due" />
      ),
      cell: ({ row }) => {
        const d = formatDueLabel(row.original);
        return (
          <span
            className={cn(
              "text-sm",
              d.tone === "danger" && "font-medium text-destructive",
              d.tone === "warning" && "font-medium text-warning",
              d.tone === "muted" && "text-muted-foreground",
            )}
          >
            {d.label}
          </span>
        );
      },
      sortingFn: (a, b) => {
        const ad = a.original.dueDate ? new Date(a.original.dueDate).getTime() : 0;
        const bd = b.original.dueDate ? new Date(b.original.dueDate).getTime() : 0;
        return ad - bd;
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const inv = row.original;
        const canMarkPaid = inv.status !== "paid" && inv.status !== "cancelled";
        const canEdit = inv.status === "draft";
        const canDelete = inv.status === "draft";
        const canCancel =
          inv.status === "sent" ||
          inv.status === "viewed" ||
          inv.status === "overdue";
        const canResend =
          inv.status === "sent" ||
          inv.status === "viewed" ||
          inv.status === "overdue";
        const canSend = inv.status === "draft";
        return (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/invoices/${inv.id}`}>
                    <Eye /> View
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/dashboard/invoices/${inv.id}/edit`}>
                      <Pencil /> Edit
                    </Link>
                  </DropdownMenuItem>
                )}
                {canSend && (
                  <DropdownMenuItem onClick={() => onResend(inv)}>
                    <Send /> Send invoice
                  </DropdownMenuItem>
                )}
                {canResend && (
                  <DropdownMenuItem onClick={() => onResend(inv)}>
                    <Send /> Resend reminder
                  </DropdownMenuItem>
                )}
                {canMarkPaid && (
                  <DropdownMenuItem onClick={() => onMarkPaid(inv)}>
                    Mark as paid
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDuplicate(inv)}>
                  <Copy /> Duplicate
                </DropdownMenuItem>
                {canCancel && (
                  <DropdownMenuItem
                    onClick={() => onCancel(inv)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Ban /> Cancel invoice
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(inv)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
