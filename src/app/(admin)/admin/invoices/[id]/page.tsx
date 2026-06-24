/**
 * /admin/invoices/[id] — read-only invoice detail.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { getInvoiceDetail, listAdminNotes } from "@/features/admin/queries";
import { recordAdminAction, requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminNotesPanel } from "@/components/admin/admin-notes";
import {
  formatCurrencyAmount,
  formatIstStamp,
  formatRelative,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminInvoiceDetailPage({ params }: Props) {
  const { id } = await params;
  const actor = await requireAdmin();
  const { invoice, items, deliveries } = await getInvoiceDetail(id);
  if (!invoice) notFound();

  const notes = await listAdminNotes("invoice", id);

  await recordAdminAction({
    actorId: actor.id,
    kind: "invoice.read",
    targetType: "invoice",
    targetId: id,
    success: true,
    durationMs: 0,
  });

  return (
    <div className="space-y-6">
      <Link
        href="/admin/invoices"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" /> All invoices
      </Link>

      <AdminPageHeader
        title={`Invoice ${invoice.invoice_number}`}
        subtitle={
          <span className="space-x-2">
            <span>{invoice.full_name}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono">{invoice.email}</span>
          </span>
        }
        actions={
          <Link
            href={`/admin/users/${invoice.user_id}`}
            className="rounded border px-3 py-1.5 text-xs hover:bg-accent"
          >
            Open user
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Status" value={invoice.status} />
        <Tile
          label="Total"
          value={formatCurrencyAmount(invoice.total_amount, invoice.currency)}
        />
        <Tile label="Issued" value={formatIstStamp(invoice.issue_date)} />
        <Tile label="Due" value={formatIstStamp(invoice.due_date)} />
      </section>

      <section className="space-y-2">
        <Section count={items.length}>Line items</Section>
        {items.length === 0 ? (
          <Empty>No items.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-md border bg-card text-xs">
            {items.map((it) => (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex-1 truncate font-medium">
                  {it.description}
                </div>
                <span className="ml-3 font-mono tabular-nums text-muted-foreground">
                  {it.quantity} × {formatCurrencyAmount(it.unit_price, invoice.currency)}
                </span>
                <span className="ml-3 font-mono tabular-nums">
                  {formatCurrencyAmount(it.amount, invoice.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <Section count={deliveries.length}>Recent deliveries</Section>
        {deliveries.length === 0 ? (
          <Empty>No deliveries logged.</Empty>
        ) : (
          <ul className="overflow-hidden rounded-md border bg-card text-xs">
            {deliveries.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-3 border-b border-border/40 p-2.5 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      d.status === "delivered"
                        ? "bg-emerald-500"
                        : d.status === "failed" ||
                            d.status === "bounced" ||
                            d.status === "blocked"
                          ? "bg-red-500"
                          : "bg-muted-foreground/50",
                    )}
                  />
                  <span className="font-medium">{d.kind}</span>
                  <span className="text-muted-foreground">{d.status}</span>
                  {d.to_email ? (
                    <span className="font-mono">{d.to_email}</span>
                  ) : null}
                </div>
                <span className="font-mono tabular-nums text-muted-foreground">
                  {formatRelative(d.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminNotesPanel targetType="invoice" targetId={invoice.id} notes={notes} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
function Section({
  count,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {typeof count === "number" ? (
        <span className="rounded bg-muted px-1.5 text-[10px] tabular-nums">
          {count}
        </span>
      ) : null}
    </h2>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
      {children}
    </div>
  );
}
