import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Pencil, FileText, Send, Eye, CheckCircle2, Clock, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { getInvoice } from "@/features/invoices/server";
import { getClient } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import { MarkPaidManuallyDialog } from "@/features/invoices/components/mark-paid-manually-dialog";
import { InvoiceShareButtons } from "@/features/invoices/components/invoice-share-buttons";
import { SendInvoiceButton } from "@/features/invoices/components/send-invoice-button";
import { DuplicateInvoiceButton } from "@/features/invoices/components/duplicate-invoice-button";
import { CancelInvoiceButton } from "@/features/invoices/components/cancel-invoice-button";
import { listActivity, type ActivityRecord } from "@/features/activity/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoice(id);
  return { title: result ? `Invoice ${result.invoice.invoiceNumber}` : "Invoice" };
}

import { InternationalComplianceNote } from "@/features/invoices/components/international-compliance-note";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getInvoice(id);
  if (!result) notFound();
  const { invoice, items } = result;
  const cur = (invoice as { currency?: string }).currency ?? "INR";
  const isExport =
    (invoice as { isExport?: boolean; is_export?: boolean }).isExport ??
    (invoice as { is_export?: boolean }).is_export ??
    false;
  const [client, activities] = await Promise.all([
    invoice.clientId ? getClient(invoice.clientId) : Promise.resolve(null),
    listActivity({ entityType: "invoice", entityId: id, limit: 20 }),
  ]);

  const fmtDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <div className="space-y-6">
      {isExport ? <InternationalComplianceNote /> : null}
      {/* Header: stacks vertically on mobile so action buttons get full width
          and don't collide with the invoice number. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/dashboard/invoices" aria-label="Back to invoices">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {invoice.invoiceNumber}
              </h1>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Issued {fmtDate(invoice.issueDate)} · Due {fmtDate(invoice.dueDate)}
              {invoice.status === "paid" && invoice.paidAt
                ? ` · Paid ${fmtDate(invoice.paidAt)}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {/* Send button — only for draft invoices that haven't been sent yet */}
          {invoice.status === "draft" && (
            <SendInvoiceButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              compact
            />
          )}

          {/* Draft → Edit. Once sent, the invoice is locked for credibility +
              legal integrity; corrections go through "Duplicate to edit". */}
          {invoice.status === "draft" ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
            >
              <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
          ) : (
            <DuplicateInvoiceButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              label="Duplicate to edit"
            />
          )}

          <InvoiceShareButtons
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber}
            totalAmount={invoice.totalAmount}
            clientName={client ? getClientDisplayName(client) : null}
            clientPhone={client?.phone ?? null}
            publicToken={invoice.publicToken}
          />
          <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              aria-label="View or download invoice PDF"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Invoice PDF</span>
              <span className="sm:hidden">PDF</span>
            </a>
          </Button>
          {invoice.status === "paid" && (
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <a
                href={`/api/invoices/${invoice.id}/receipt/pdf`}
                target="_blank"
                rel="noreferrer"
                aria-label="View or download receipt PDF"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Receipt PDF</span>
                <span className="sm:hidden">Receipt</span>
              </a>
            </Button>
          )}
          {(invoice.status === "sent" ||
            invoice.status === "viewed" ||
            invoice.status === "overdue") && (
            <CancelInvoiceButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
            />
          )}
          {invoice.status !== "cancelled" && (
            <MarkPaidManuallyDialog
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              amountLabel={formatMoney(invoice.totalAmount, cur)}
              alreadyPaid={invoice.status === "paid"}
            />
          )}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bill to
              </p>
              <p className="mt-2 truncate text-sm font-medium">
                {client ? getClientDisplayName(client) : "—"}
              </p>
              {client?.email && (
                <p className="truncate text-xs text-muted-foreground">{client.email}</p>
              )}
              {client?.gstin && (
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  GSTIN {client.gstin}
                </p>
              )}
            </div>
            <div className="min-w-0 sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums sm:text-3xl">
                {formatMoney(invoice.totalAmount, cur)}
              </p>
              {invoice.taxTotal > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  incl. {formatMoney(invoice.taxTotal, cur)} GST
                </p>
              )}
              {invoice.status === "paid" && (
                <p className="mt-2 text-xs text-success">
                  Paid {fmtDate(invoice.paidAt)}
                </p>
              )}
            </div>
          </div>

          {/* Mobile: stacked line-item cards. Desktop: classic table.
              We render both and toggle with md: utilities — the
              underlying data is the same. */}
          <div className="md:hidden">
            {items.length === 0 ? (
              <div className="rounded-lg border bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                No line items
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border bg-card p-3 text-sm"
                  >
                    <p className="break-words font-medium leading-snug">
                      {item.description}
                    </p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <dt>Qty</dt>
                      <dd className="text-right tabular-nums text-foreground">
                        {item.quantity}
                      </dd>
                      <dt>Rate</dt>
                      <dd className="text-right tabular-nums text-foreground">
                        {formatMoney(item.unitPrice, cur)}
                      </dd>
                      <dt>GST</dt>
                      <dd className="text-right tabular-nums text-foreground">
                        {invoice.taxMode === "non_gst"
                          ? "N/A"
                          : `${item.gstRate}%`}
                      </dd>
                      <dt className="font-medium text-foreground">Amount</dt>
                      <dd className="text-right text-sm font-semibold tabular-nums">
                        {formatMoney(item.amount, cur)}
                      </dd>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="hidden overflow-hidden rounded-lg border md:block">
            <div className="w-full overflow-x-auto overscroll-x-contain scrollbar-thin">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">GST</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-xs text-muted-foreground"
                      >
                        No line items
                      </td>
                    </tr>
                  )}
                  {items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-3">{item.description}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(item.unitPrice, cur)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {invoice.taxMode === "non_gst" ? "N/A" : `${item.gstRate}%`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(item.amount, cur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-xs text-muted-foreground">
              {invoice.notes && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                    Notes
                  </p>
                  <p className="whitespace-pre-line">{invoice.notes}</p>
                </>
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {invoice.terms && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider">
                    Terms
                  </p>
                  <p className="whitespace-pre-line">{invoice.terms}</p>
                </>
              )}
            </div>
          </div>

          <dl className="ml-auto grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t pt-4 sm:w-auto">
            <Row label="Subtotal" value={formatMoney(invoice.subtotal, cur)} />
            {invoice.discount > 0 && (
              <Row label="Discount" value={`-${formatMoney(invoice.discount, cur)}`} />
            )}
            {invoice.cgstAmount > 0 && (
              <Row label="CGST" value={formatMoney(invoice.cgstAmount, cur)} />
            )}
            {invoice.sgstAmount > 0 && (
              <Row label="SGST" value={formatMoney(invoice.sgstAmount, cur)} />
            )}
            {invoice.igstAmount > 0 && (
              <Row label="IGST" value={formatMoney(invoice.igstAmount, cur)} />
            )}
            <Row label="Total" value={formatMoney(invoice.totalAmount, cur)} bold />
          </dl>
        </CardContent>
      </Card>

      {/* Activity timeline */}
      {activities.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </p>
            <ol className="relative space-y-0 border-l border-border pl-5">
              {activities.map((event) => (
                <ActivityItem key={event.id} event={event} />
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={
          "text-right tabular-nums " +
          (bold ? "text-sm font-semibold" : "text-sm")
        }
      >
        {value}
      </dd>
    </>
  );
}

const ACTIVITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  invoice_created: Plus,
  invoice_sent: Send,
  invoice_viewed: Eye,
  invoice_paid: CheckCircle2,
  invoice_overdue: Clock,
  invoice_draft: FileText,
};

function ActivityItem({ event }: { event: ActivityRecord }) {
  const Icon = ACTIVITY_ICON[event.kind] ?? FileText;
  return (
    <li className="relative pb-4 last:pb-0">
      {/* Dot on the timeline rail */}
      <span className="absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full border bg-background">
        <Icon className="h-2.5 w-2.5 text-muted-foreground" />
      </span>
      <div className="ml-1">
        <p className="text-sm font-medium leading-snug">{event.title}</p>
        {event.message && (
          <p className="mt-0.5 text-xs text-muted-foreground">{event.message}</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          {new Date(event.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </li>
  );
}
