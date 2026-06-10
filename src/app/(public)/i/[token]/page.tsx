import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSharedInvoice, recordInvoiceView } from "@/features/share/server";
import { buildInvoicePdfDataByToken } from "@/features/documents/builders";
import { getInvoicePdfShareUrl } from "@/features/documents/urls";
import { getUserPaymentMethod } from "@/features/billing/payment-methods";
import { PublicPaymentPanel } from "@/features/invoices/components/public-payment-panel";
import { PublicUpiPanel } from "@/features/invoices/components/public-upi-panel";
import { renderUpiQrSvg } from "@/features/invoices/upi";
import { getOrCreateInvoiceVirtualAccount } from "@/features/billing/razorpay/smart-collect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const data = await buildInvoicePdfDataByToken(token);
  if (!data) return { title: "Invoice not found" };
  return {
    title: `Invoice ${data.invoiceNumber} – ${data.seller.businessName}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params;
  const [shared, viewModel] = await Promise.all([
    getSharedInvoice(token),
    buildInvoicePdfDataByToken(token),
  ]);
  if (!shared || !viewModel) notFound();

  // Fire-and-forget view counter.
  void recordInvoiceView(token);

  const method = await getUserPaymentMethod(shared.invoice.user_id);

  const status = shared.invoice.status;
  const isPaid = status === "paid";
  const isOverdue = status === "overdue";

  const senderName = viewModel.seller.businessName ?? "Stackivo";
  const accent = viewModel.brandColor ?? "#0F172A";
  const amountFormatted = fmt(Number(shared.invoice.total_amount), shared.invoice.currency);

  // UPI QR is rendered server-side so there's no client-side bundle.
  let upiPanelProps: { qrSvg: string; vpa: string; upiUri: string } | null = null;

  if (method?.type === "upi_manual") {
    const { svg, uri } = await renderUpiQrSvg({
      vpa: method.payout.vpa,
      payeeName: senderName,
      amount: Number(shared.invoice.total_amount),
      note: `Invoice ${viewModel.invoiceNumber}`,
      ref: viewModel.invoiceNumber,
    });
    upiPanelProps = { qrSvg: svg, vpa: method.payout.vpa, upiUri: uri };
  } else if (method?.type === "upi_smart" && !isPaid) {
    // Smart Collect: lazily create (or reuse) a per-invoice virtual account.
    try {
      const va = await getOrCreateInvoiceVirtualAccount(shared.invoice.id);
      const { svg, uri } = await renderUpiQrSvg({
        vpa: va.vpa,
        payeeName: senderName,
        amount: Number(shared.invoice.total_amount),
        note: `Invoice ${viewModel.invoiceNumber}`,
        ref: viewModel.invoiceNumber,
      });
      upiPanelProps = { qrSvg: svg, vpa: va.vpa, upiUri: uri };
    } catch {
      // VA creation failed — fall through to "Pay outside Stackivo" fallback.
    }
  }

  const fmtDate = (iso: string | null | undefined) =>
    iso
      ? new Date(iso).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  const docLabel = viewModel.taxMode === "non_gst" ? "Invoice" : "Tax Invoice";
  const pdfUrl = getInvoicePdfShareUrl(token);

  const isPartiallyPaid = status === "partially_paid";
  const paidSoFar =
    isPartiallyPaid && Number(shared.invoice.payment_amount ?? 0) > 0
      ? Math.min(Number(shared.invoice.payment_amount), Number(shared.invoice.total_amount))
      : 0;
  const balanceDue = Number(shared.invoice.total_amount) - paidSoFar;

  const statusChip = isPaid
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isOverdue
      ? "bg-red-50 text-red-700 border-red-200"
      : isPartiallyPaid
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";

  const statusLabel = isPaid
    ? "Paid"
    : isOverdue
      ? "Overdue"
      : isPartiallyPaid
        ? "Partially paid"
        : status === "sent"
          ? "Due"
          : status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="min-h-svh bg-slate-50/80">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">

        {/* Top bar — sender identity + PDF download */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {viewModel.seller.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewModel.seller.logoDataUrl}
                alt={senderName}
                className="h-10 w-10 shrink-0 rounded-lg object-contain border border-slate-200 bg-white p-0.5"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: accent }}
              >
                {senderName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{senderName}</p>
              <p className="text-xs text-slate-500">Sent you {docLabel.toLowerCase() === "invoice" ? "an invoice" : "a tax invoice"}</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a href={pdfUrl} download={`invoice-${viewModel.invoiceNumber}.pdf`} rel="noopener">
              <Download className="h-4 w-4" />
              <span className="hidden xs:inline">Download PDF</span>
            </a>
          </Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">

          {/* ── INVOICE CARD ─────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Brand accent bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

            <div className="p-6 sm:p-8">

              {/* Invoice header — number + amount */}
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {docLabel}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusChip}`}
                    >
                      {isPaid && <Check className="h-3 w-3" />}
                      {statusLabel}
                    </span>
                  </div>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    {viewModel.invoiceNumber}
                  </h1>
                  {isPaid ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <Check className="h-4 w-4" />
                      Paid on {fmtDate(viewModel.paidAt)}
                    </p>
                  ) : (
                    <p className={`mt-1.5 text-sm ${isOverdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                      Due {fmtDate(viewModel.dueDate)}
                    </p>
                  )}
                </div>
                <div className="shrink-0 sm:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {isPaid ? "Amount Paid" : "Amount Due"}
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
                    {paidSoFar > 0 ? fmt(balanceDue, shared.invoice.currency) : amountFormatted}
                  </p>
                  {paidSoFar > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      {fmt(paidSoFar, shared.invoice.currency)} received
                    </p>
                  )}
                </div>
              </div>

              {/* Parties + dates */}
              <div className="mb-8 grid gap-6 border-y border-slate-100 py-6 sm:grid-cols-3">
                {/* From */}
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    From
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{senderName}</p>
                  {viewModel.seller.legalName && viewModel.seller.legalName !== senderName && (
                    <p className="text-xs text-slate-500">{viewModel.seller.legalName}</p>
                  )}
                  {viewModel.seller.email && (
                    <p className="mt-0.5 text-xs text-slate-500">{viewModel.seller.email}</p>
                  )}
                  {viewModel.seller.addressLines.slice(0, 2).map((l, i) => (
                    <p key={i} className="text-xs text-slate-500">{l}</p>
                  ))}
                  {viewModel.seller.gstin && (
                    <p className="mt-0.5 text-xs text-slate-500">GSTIN: {viewModel.seller.gstin}</p>
                  )}
                </div>

                {/* Billed to */}
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Billed To
                  </p>
                  <p className="text-sm font-semibold text-slate-900">{viewModel.client.name}</p>
                  {viewModel.client.companyName && (
                    <p className="text-xs text-slate-500">{viewModel.client.companyName}</p>
                  )}
                  {viewModel.client.email && (
                    <p className="mt-0.5 text-xs text-slate-500">{viewModel.client.email}</p>
                  )}
                  {viewModel.client.gstin && (
                    <p className="mt-0.5 text-xs text-slate-500">GSTIN: {viewModel.client.gstin}</p>
                  )}
                </div>

                {/* Dates */}
                <div className="sm:text-right">
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Details
                  </p>
                  <dl className="space-y-1">
                    <div className="flex gap-2 text-xs sm:flex-row-reverse">
                      <dt className="text-slate-400">Issue date</dt>
                      <dd className="font-medium text-slate-700">{fmtDate(viewModel.issueDate)}</dd>
                    </div>
                    <div className="flex gap-2 text-xs sm:flex-row-reverse">
                      <dt className="text-slate-400">Due date</dt>
                      <dd className={`font-medium ${isOverdue ? "text-red-600" : "text-slate-700"}`}>
                        {fmtDate(viewModel.dueDate)}
                      </dd>
                    </div>
                    <div className="flex gap-2 text-xs sm:flex-row-reverse">
                      <dt className="text-slate-400">Type</dt>
                      <dd className="font-medium text-slate-700">{docLabel}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Line items */}
              <div className="mb-6 overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-2.5 text-left">Description</th>
                      <th className="pb-2.5 w-12 text-right">Qty</th>
                      <th className="pb-2.5 w-32 pr-6 text-right">Rate</th>
                      {viewModel.taxMode !== "non_gst" && (
                        <th className="pb-2.5 w-16 pr-4 text-right">GST</th>
                      )}
                      <th className="pb-2.5 w-32 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModel.items.map((item, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-3 pr-4 text-slate-800">{item.description}</td>
                        <td className="py-3 text-right tabular-nums text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="py-3 pr-6 text-right tabular-nums text-slate-600">
                          {fmt(item.unitPrice, viewModel.currency)}
                        </td>
                        {viewModel.taxMode !== "non_gst" && (
                          <td className="py-3 pr-4 text-right tabular-nums text-slate-600">
                            {item.gstRate}%
                          </td>
                        )}
                        <td className="py-3 text-right font-semibold tabular-nums text-slate-900">
                          {fmt(item.amount, viewModel.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <dl className="grid w-full max-w-[280px] grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-slate-200 pt-4">
                  <dt className="text-xs text-slate-500">Subtotal</dt>
                  <dd className="text-right text-sm tabular-nums text-slate-700">
                    {fmt(viewModel.subtotal, viewModel.currency)}
                  </dd>
                  {viewModel.discount > 0 && (
                    <>
                      <dt className="text-xs text-slate-500">Discount</dt>
                      <dd className="text-right text-sm tabular-nums text-emerald-700">
                        -{fmt(viewModel.discount, viewModel.currency)}
                      </dd>
                    </>
                  )}
                  {viewModel.cgstAmount > 0 && (
                    <>
                      <dt className="text-xs text-slate-500">CGST</dt>
                      <dd className="text-right text-sm tabular-nums text-slate-700">
                        {fmt(viewModel.cgstAmount, viewModel.currency)}
                      </dd>
                    </>
                  )}
                  {viewModel.sgstAmount > 0 && (
                    <>
                      <dt className="text-xs text-slate-500">SGST</dt>
                      <dd className="text-right text-sm tabular-nums text-slate-700">
                        {fmt(viewModel.sgstAmount, viewModel.currency)}
                      </dd>
                    </>
                  )}
                  {viewModel.igstAmount > 0 && (
                    <>
                      <dt className="text-xs text-slate-500">IGST</dt>
                      <dd className="text-right text-sm tabular-nums text-slate-700">
                        {fmt(viewModel.igstAmount, viewModel.currency)}
                      </dd>
                    </>
                  )}
                  {viewModel.taxMode === "non_gst" && (
                    <>
                      <dt className="text-xs text-slate-400">GST</dt>
                      <dd className="text-right text-xs text-slate-400">Not applicable</dd>
                    </>
                  )}
                  {paidSoFar > 0 && (
                    <>
                      <dt className="text-xs text-slate-500">Paid to date</dt>
                      <dd className="text-right text-sm tabular-nums text-emerald-700">
                        -{fmt(paidSoFar, viewModel.currency)}
                      </dd>
                    </>
                  )}
                  <dt className="border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                    {isPaid ? "Total Paid" : paidSoFar > 0 ? "Balance Due" : "Amount Due"}
                  </dt>
                  <dd className="border-t border-slate-200 pt-2 text-right text-sm font-bold tabular-nums text-slate-900">
                    {fmt(paidSoFar > 0 ? balanceDue : viewModel.totalAmount, viewModel.currency)}
                  </dd>
                </dl>
              </div>

              {/* Notes / Terms */}
              {(viewModel.notes || viewModel.terms) && (
                <div className="mt-6 grid gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                  {viewModel.notes && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Notes
                      </p>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">
                        {viewModel.notes}
                      </p>
                    </div>
                  )}
                  {viewModel.terms && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Terms
                      </p>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">
                        {viewModel.terms}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── SIDEBAR ──────────────────────────────────────────────── */}
          <aside className="space-y-4">
            {method?.type === "stackivo_managed" ? (
              <PublicPaymentPanel
                token={token}
                amountFormatted={amountFormatted}
                invoiceNumber={viewModel.invoiceNumber}
                alreadyPaid={isPaid}
                freelancerName={senderName}
                prefill={{
                  name: viewModel.client?.name ?? undefined,
                  email: viewModel.client?.email ?? undefined,
                }}
              />
            ) : (method?.type === "upi_manual" || method?.type === "upi_smart") &&
              upiPanelProps ? (
              <PublicUpiPanel
                qrSvg={upiPanelProps.qrSvg}
                vpa={upiPanelProps.vpa}
                upiUri={upiPanelProps.upiUri}
                amountFormatted={amountFormatted}
                invoiceNumber={viewModel.invoiceNumber}
                alreadyPaid={isPaid}
              />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">Pay outside Stackivo</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {senderName} hasn&apos;t set up online payments yet. Please pay using the
                  bank or UPI details on the invoice and let them know once it&apos;s done.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">Need help?</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Reply to the email this invoice came from to reach{" "}
                <span className="font-medium text-slate-700">{senderName}</span> directly.
              </p>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="mt-8 flex items-center justify-between text-xs text-slate-400">
          <p>
            Sent by{" "}
            <span className="font-medium text-slate-600">{senderName}</span>
          </p>
          <p>
            Powered by{" "}
            <Link href="/" className="font-medium text-slate-600 hover:underline underline-offset-2">
              Stackivo
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

function fmt(value: number, currency: string): string {
  if (!Number.isFinite(value)) return `${currency} 0`;
  const amt = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${amt}`;
}
