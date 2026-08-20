/**
 * /admin/contracts - read-only contract list.
 */

import Link from "next/link";
import { listContracts } from "@/features/admin/queries";
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
import { formatIstStamp, formatRelative } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const STATUSES = [
  "all",
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
] as const;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminContractsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = asString(sp.q);
  const status = parseStatus(asString(sp.status)) ?? "all";
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listContracts({ q, status, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Contracts"
        subtitle={`${result.total.toLocaleString("en-IN")} matches - page ${page} / ${totalPages}`}
      />

      <form
        method="get"
        action="/admin/contracts"
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-2 shadow-sm shadow-black/[0.025] dark:bg-card"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Title contains..."
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:w-56 sm:flex-none"
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
      </form>

      <AdminTableShell>
        <AdminTable>
          <AdminThead>
            <tr>
              <AdminTh>Title</AdminTh>
              <AdminTh>User</AdminTh>
              <AdminTh>Kind</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh className="hidden tabular-nums sm:table-cell">Signed</AdminTh>
              <AdminTh className="tabular-nums">Updated</AdminTh>
            </tr>
          </AdminThead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-xs text-muted-foreground"
                >
                  No contracts match these filters.
                </td>
              </tr>
            ) : (
              result.rows.map((c) => (
                <AdminTr key={c.id}>
                  <AdminTd>
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                  </AdminTd>
                  <AdminTd>
                    <div className="leading-tight">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="truncate text-micro text-muted-foreground">
                        {c.email}
                      </div>
                    </div>
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">
                    {c.kind}
                  </AdminTd>
                  <AdminTd>
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-micro font-medium uppercase tracking-wider",
                        c.status === "signed"
                          ? "bg-success-subtle text-success-strong"
                          : c.status === "declined" || c.status === "expired"
                            ? "bg-destructive-subtle text-destructive-strong"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.status}
                    </span>
                  </AdminTd>
                  <AdminTd className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:table-cell">
                    {c.signed_at ? formatIstStamp(c.signed_at) : "-"}
                  </AdminTd>
                  <AdminTd className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatRelative(c.updated_at)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>
    </AdminSection>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function parseStatus(v: string | undefined): string | undefined {
  return (STATUSES as readonly string[]).includes(v ?? "") ? v : undefined;
}
