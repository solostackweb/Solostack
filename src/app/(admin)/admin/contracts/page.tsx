/**
 * /admin/contracts — read-only contract list.
 */

import Link from "next/link";
import { listContracts } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection } from "@/components/admin/kit";
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
        subtitle={`${result.total.toLocaleString("en-IN")} matches · page ${page} / ${totalPages}`}
      />

      <form
        method="get"
        action="/admin/contracts"
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Title contains…"
          className="h-8 w-56 rounded border bg-background px-2 text-xs"
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
      </form>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Kind</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="hidden px-3 py-2 font-medium tabular-nums sm:table-cell">
                Signed
              </th>
              <th className="px-3 py-2 font-medium tabular-nums">Updated</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No contracts match.
                </td>
              </tr>
            ) : (
              result.rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border/40 hover:bg-accent/30"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/contracts/${c.id}`}
                      className="hover:underline"
                    >
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <div className="leading-tight">
                      <div className="font-medium">{c.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {c.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.kind}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        c.status === "signed"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : c.status === "declined" || c.status === "expired"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                    {c.signed_at ? formatIstStamp(c.signed_at) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatRelative(c.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminSection>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function parseStatus(v: string | undefined): string | undefined {
  return (STATUSES as readonly string[]).includes(v ?? "") ? v : undefined;
}
