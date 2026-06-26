/**
 * /admin/invoices — read-only invoice list.
 *
 * Filter by status (draft / sent / viewed / paid / overdue / partially_paid)
 * or invoice number substring. Clicking a row opens the detail view.
 */

import Link from "next/link";
import { listInvoices } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
import { formatCurrencyAmount, formatIstStamp } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUSES = [
  "all",
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "partially_paid",
] as const;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminInvoicesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = asString(sp.q);
  const status = parseStatus(asString(sp.status)) ?? "all";
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listInvoices({ q, status, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Invoices"
        subtitle={`${result.total.toLocaleString("en-IN")} matches · page ${page} / ${totalPages}`}
      />

      <form
        method="get"
        action="/admin/invoices"
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Invoice number…"
          className="h-8 w-48 rounded border bg-background px-2 text-xs"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-8 rounded border bg-background px-2 text-xs"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-8 rounded border bg-background px-3 text-xs hover:bg-accent"
        >
          Apply
        </button>
        <Link
          href="/admin/invoices"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </Link>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Number</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium tabular-nums">Total</th>
              <th className="hidden px-3 py-2 font-medium tabular-nums sm:table-cell">
                Issued
              </th>
              <th className="hidden px-3 py-2 font-medium tabular-nums md:table-cell">
                Due
              </th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No invoices match.
                </td>
              </tr>
            ) : (
              result.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border/40 hover:bg-accent/30"
                >
                  <td className="px-3 py-2 font-mono">
                    <Link
                      href={`/admin/invoices/${r.id}`}
                      className="hover:underline"
                    >
                      {r.invoice_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="leading-tight">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatCurrencyAmount(r.total_amount, r.currency)}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                    {formatIstStamp(r.issue_date)}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground md:table-cell">
                    {formatIstStamp(r.due_date)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} q={q} status={status} />
      ) : null}
    </AdminSection>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : status === "overdue"
        ? "bg-red-500/10 text-red-700 dark:text-red-400"
        : status === "draft"
          ? "bg-muted text-muted-foreground"
          : "bg-sky-500/10 text-sky-700 dark:text-sky-400";
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
      )}
    >
      {status}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  q,
  status,
}: {
  page: number;
  totalPages: number;
  q?: string;
  status: string;
}) {
  const mk = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("status", status);
    sp.set("page", String(p));
    return `/admin/invoices?${sp.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between text-xs">
      <Link
        href={mk(Math.max(1, page - 1))}
        className={cn(
          "rounded border px-2 py-1",
          page === 1 ? "pointer-events-none opacity-40" : "hover:bg-accent",
        )}
      >
        ← Prev
      </Link>
      <span className="text-muted-foreground tabular-nums">
        Page {page} / {totalPages}
      </span>
      <Link
        href={mk(Math.min(totalPages, page + 1))}
        className={cn(
          "rounded border px-2 py-1",
          page === totalPages
            ? "pointer-events-none opacity-40"
            : "hover:bg-accent",
        )}
      >
        Next →
      </Link>
    </nav>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function parseStatus(v: string | undefined): string | undefined {
  return (STATUSES as readonly string[]).includes(v ?? "") ? v : undefined;
}
