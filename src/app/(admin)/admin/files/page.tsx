/**
 * /admin/files - read-only file inventory.
 *
 * Shows total storage footprint (capped 10k row scan) + a filterable
 * list with type + size columns. Useful for spotting users who are
 * about to bust the per-plan storage cap.
 */

import Link from "next/link";
import { Files as FilesIcon, HardDrive, FileText } from "lucide-react";
import { listFiles } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, KpiGrid, StatCard } from "@/components/admin/kit";
import { formatRelative, shortenId } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function AdminFilesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = asString(sp.q);
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listFiles({ q, page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Files"
        subtitle={
          <span>
            {result.total.toLocaleString("en-IN")} files - scanned storage{" "}
            <strong>{formatBytes(result.totalBytes)}</strong>
            <span className="ml-1 text-muted-foreground/70">
              (first 10k rows; full total via /admin/query)
            </span>
          </span>
        }
      />

      <KpiGrid cols={3}>
        <StatCard icon={FilesIcon} label="Files (scanned)" value={result.total.toLocaleString("en-IN")} tone="neutral" />
        <StatCard icon={HardDrive} label="Storage" value={formatBytes(result.totalBytes)} tone="info" />
        <StatCard icon={FileText} label="Avg size" value={formatBytes(result.total > 0 ? Math.round(result.totalBytes / result.total) : 0)} tone="neutral" />
      </KpiGrid>

      <form
        method="get"
        action="/admin/files"
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Filename contains..."
          className="h-8 w-64 rounded border bg-background px-2 text-xs"
        />
        <button
          type="submit"
          className="h-8 rounded border bg-background px-3 text-xs hover:bg-accent"
        >
          Apply
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm shadow-black/[0.03]">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium tabular-nums">Size</th>
              <th className="hidden px-3 py-2 font-medium tabular-nums sm:table-cell">
                Project
              </th>
              <th className="px-3 py-2 font-medium tabular-nums">Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-xs text-muted-foreground"
                >
                  No files match.
                </td>
              </tr>
            ) : (
              result.rows.map((f) => (
                <tr key={f.id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono">{f.file_name}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/users/${f.user_id}`}
                      className="block leading-tight hover:underline"
                    >
                      <div className="font-medium">{f.full_name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {f.email}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {f.mime_type ?? "-"}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {formatBytes(f.file_size)}
                  </td>
                  <td className="hidden px-3 py-2 font-mono text-[11px] text-muted-foreground sm:table-cell">
                    {f.project_id ? shortenId(f.project_id) : "-"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatRelative(f.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-xs">
          <Link
            href={`/admin/files?q=${q ?? ""}&page=${Math.max(1, page - 1)}`}
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
            href={`/admin/files?q=${q ?? ""}&page=${Math.min(totalPages, page + 1)}`}
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
      ) : null}
    </AdminSection>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
