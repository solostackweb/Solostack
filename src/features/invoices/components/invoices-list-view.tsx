"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";

import type { InvoiceRecord } from "../server";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";
import { getClientDisplayName } from "@/features/clients/utils";
import {
  buildInvoiceColumns,
  type InvoiceColumnLookup,
} from "./invoices-columns";
import { InvoicesSummary } from "./invoices-summary";
import { InvoicesToolbar } from "./invoices-toolbar";
import { InvoicesBulkActions } from "./invoices-bulk-actions";
import { InvoiceMobileCard } from "./invoice-mobile-card";
import {
  deleteInvoiceAction,
  cancelInvoiceAction,
  setInvoiceStatusAction,
  duplicateInvoiceAction,
} from "../actions";
import { sendInvoiceAction } from "../delivery";

interface InvoicesListViewProps {
  invoices: InvoiceRecord[];
  clients: ClientRecord[];
  projects: ProjectRecord[];
  nextInvoiceNumber: string;
}

/**
 * Orchestrator for the invoices list. Receives the authoritative snapshot
 * from the server page; mutations route through real server actions and a
 * `router.refresh()` re-hydrates the snapshot.
 */
export function InvoicesListView({
  invoices,
  clients,
}: InvoicesListViewProps) {
  const router = useRouter();
  const [pendingDeleteIds, setPendingDeleteIds] = React.useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [cancelTarget, setCancelTarget] = React.useState<InvoiceRecord | null>(null);
  const [, startTransition] = React.useTransition();

  const lookup: InvoiceColumnLookup = React.useMemo(
    () => ({
      clientNameById: new Map(clients.map((c) => [c.id, getClientDisplayName(c)])),
    }),
    [clients],
  );

  const clientOptions = React.useMemo(() => {
    const present = new Set(
      invoices.map((i) => i.clientId).filter(Boolean) as string[],
    );
    return clients
      .filter((c) => present.has(c.id))
      .map((c) => ({ value: c.id, label: getClientDisplayName(c) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices, clients]);

  // --- single-row actions used inside column dropdowns ---------------------

  const runStatusChange = (
    invoice: InvoiceRecord,
    next: "paid",
  ) => {
    const fd = new FormData();
    fd.set("id", invoice.id);
    fd.set("status", next);
    startTransition(async () => {
      const res = await setInvoiceStatusAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${invoice.invoiceNumber} marked as paid`,
      );
      router.refresh();
    });
  };

  const handleMarkPaid = (invoice: InvoiceRecord) =>
    runStatusChange(invoice, "paid");

  const handleDelete = (invoice: InvoiceRecord) => {
    setPendingDeleteIds([invoice.id]);
    setBulkDeleteOpen(true);
  };

  const handleCancel = (invoice: InvoiceRecord) => {
    setCancelTarget(invoice);
  };

  const confirmCancel = () => {
    const target = cancelTarget;
    if (!target) return;
    const fd = new FormData();
    fd.set("id", target.id);
    startTransition(async () => {
      const res = await cancelInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(`${target.invoiceNumber} cancelled`);
      }
      setCancelTarget(null);
      router.refresh();
    });
  };

  const handleDuplicate = (invoice: InvoiceRecord) => {
    const fd = new FormData();
    fd.set("id", invoice.id);
    startTransition(async () => {
      const res = await duplicateInvoiceAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${invoice.invoiceNumber} duplicated as draft`);
      router.refresh();
      if (res.data?.id) {
        router.push(`/dashboard/invoices/${res.data.id}`);
      }
    });
  };

  const handleResend = (invoice: InvoiceRecord) => {
    startTransition(async () => {
      const res = await sendInvoiceAction({ invoiceId: invoice.id });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to send");
        return;
      }
      toast.success(`${invoice.invoiceNumber} sent to client`);
      router.refresh();
    });
  };

  const confirmDelete = () => {
    if (pendingDeleteIds.length === 0) return;
    const ids = [...pendingDeleteIds];
    startTransition(async () => {
      let okCount = 0;
      for (const id of ids) {
        const fd = new FormData();
        fd.set("id", id);
        const res = await deleteInvoiceAction(undefined, fd);
        if (res.ok) okCount += 1;
        else toast.error(res.error);
      }
      if (okCount > 0) {
        toast.success(
          `${okCount} invoice${okCount === 1 ? "" : "s"} deleted`,
        );
      }
      setPendingDeleteIds([]);
      setBulkDeleteOpen(false);
      router.refresh();
    });
  };

  const columns = React.useMemo(
    () =>
      buildInvoiceColumns({
        onMarkPaid: handleMarkPaid,
        onDelete: handleDelete,
        onCancel: handleCancel,
        onDuplicate: handleDuplicate,
        onResend: handleResend,
        lookup,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookup],
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Track, send, and reconcile invoices across your clients.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/invoices/new">
              <Plus /> New invoice
            </Link>
          </Button>
        </div>
      </div>

      <InvoicesSummary invoices={invoices} />

      <DataTable
            columns={columns}
            data={invoices}
            initialPageSize={10}
            onRowClick={(inv) => router.push(`/dashboard/invoices/${inv.id}`)}
            toolbar={(table) => (
              <InvoicesToolbar table={table} clientOptions={clientOptions} />
            )}
            mobileCard={(invoice, { isSelected, toggleSelected, onOpen }) => (
              <InvoiceMobileCard
                invoice={invoice}
                clientName={
                  invoice.clientId
                    ? (lookup.clientNameById.get(invoice.clientId) ?? null)
                    : null
                }
                isSelected={isSelected}
                onToggleSelected={toggleSelected}
                onOpen={onOpen}
                onMarkPaid={() => handleMarkPaid(invoice)}
                onDelete={() => handleDelete(invoice)}
              />
            )}
            emptyState={
              invoices.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No invoices yet"
                  description="Create your first invoice to start tracking payments."
                  action={{ label: "New invoice", href: "/dashboard/invoices/new" }}
                />
              ) : (
                <EmptyState
                  icon={FileText}
                  title="No invoices match your filters"
                  description="Try adjusting your search, status, or client filter."
                />
              )
            }
            bulkBar={(table) => {
              const selected = table.getFilteredSelectedRowModel().rows;
              const count = selected.length;
              return (
                <InvoicesBulkActions
                  selectedCount={count}
                  onMarkPaid={() => {
                    const targets = selected
                      .map((r) => r.original)
                      .filter((i) => i.status !== "paid" && i.status !== "draft");
                    if (targets.length === 0) {
                      toast("Nothing to mark as paid");
                      return;
                    }
                    startTransition(async () => {
                      let okCount = 0;
                      for (const inv of targets) {
                        const fd = new FormData();
                        fd.set("id", inv.id);
                        fd.set("status", "paid");
                        const res = await setInvoiceStatusAction(undefined, fd);
                        if (res.ok) okCount += 1;
                      }
                      toast.success(
                        `${okCount} invoice${okCount === 1 ? "" : "s"} marked as paid`,
                      );
                      table.resetRowSelection();
                      router.refresh();
                    });
                  }}
                  onExport={() => {
                    const rows = selected.map((r) => r.original);
                    const headers = [
                      "Invoice #",
                      "Status",
                      "Issue Date",
                      "Due Date",
                      "Currency",
                      "Subtotal",
                      "Tax",
                      "Total",
                      "Paid At",
                    ];
                    const csvRows = rows.map((inv) =>
                      [
                        inv.invoiceNumber,
                        inv.status,
                        inv.issueDate,
                        inv.dueDate,
                        inv.currency,
                        inv.subtotal.toFixed(2),
                        inv.taxTotal.toFixed(2),
                        inv.totalAmount.toFixed(2),
                        inv.paidAt ?? "",
                      ]
                        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                        .join(","),
                    );
                    const csv = [headers.join(","), ...csvRows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Exported ${rows.length} invoice${rows.length === 1 ? "" : "s"}`);
                  }}
                  onDelete={() => {
                    setPendingDeleteIds(selected.map((r) => r.original.id));
                    setBulkDeleteOpen(true);
                  }}
                  onClear={() => table.resetRowSelection()}
                />
              );
            }}
          />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDeleteIds.length} invoice
              {pendingDeleteIds.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected invoice
              {pendingDeleteIds.length === 1 ? "" : "s"} and any associated
              line items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDeleteIds([])}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cancel invoice {cancelTarget?.invoiceNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The invoice is kept and its number retained for your records, but
              marked Cancelled — it stops counting toward revenue and any billed
              time is released. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCancelTarget(null)}>
              Keep invoice
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Cancel invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
