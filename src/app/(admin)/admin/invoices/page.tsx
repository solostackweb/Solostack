/**
 * /admin/invoices - read-only invoice list.
 *
 * Filter by status (draft / sent / viewed / paid / overdue / partially_paid)
 * or invoice number substring. Clicking a row opens the detail view.
 */

import Link from "next/link";
import { listInvoices } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import {
  AdminSection,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
} from "@/components/admin/kit";
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
        subtitle={`${result.total.toLocaleString("en-IN")} matches - page ${page} / ${totalPages}`}
      />

      <form
        method="get"
        action="/admin/invoices"
        className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-sm shadow-black/[0.025] dark:bg-card"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Invoice number..."
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:w-48 sm:flex-none"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-9 rounded-lg border bg-background px-2.5 text-xs outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-9 rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Apply
        </button>
        <Link
          href="/admin/invoices"
          className="inline-flex h-9 items-center rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Reset
        </Link>
      </form>

      <AdminTableShell>
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Number</AdminTh>
              <AdminTh>User</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh className="tabular-nums">Total</AdminTh>
              <AdminTh className="hidden tabular-nums sm:table-cell">Issued</AdminTh>
              <AdminTh className="hidden tabular-nums md:table-cell">Due</AdminTh>
            </tr>
          </AdminThead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-xs text-muted-foreground"
                >
                  No invoices match these filters.
                </td>
              </tr>
            ) : (
              result.rows.map((r) => (
                <AdminTr key={r.id}>
                  <AdminTd className="font-mono">
                    <Link
                      href={`/admin/invoices/${r.id}`}
                      className="hover:underline"
                    >
                      {r.invoice_number}
                    </Link>
                  </AdminTd>
                  <AdminTd>
                    <div className="leading-tight">
                      <div className="font-medium">{r.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.email}
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd>
                    <StatusBadge status={r.status} />
                  </AdminTd>
                  <AdminTd className="tabular-nums">
                    {formatCurrencyAmount(r.total_amount, r.currency)}
                  </AdminTd>
                  <AdminTd className="hidden font-mono text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                    {formatIstStamp(r.issue_date)}
                  </AdminTd>
                  <AdminTd className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:table-cell">
                    {formatIstStamp(r.due_date)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>

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
        Prev
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
        Next
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
