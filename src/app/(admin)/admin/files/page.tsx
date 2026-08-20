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
import {
  AdminSection,
  AdminTable,
  AdminTableShell,
  AdminTd,
  AdminTh,
  AdminThead,
  AdminTr,
  KpiGrid,
  StatCard,
} from "@/components/admin/kit";
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
        className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-2 shadow-sm shadow-black/[0.025] dark:bg-card"
      >
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Filename contains..."
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-2 focus:ring-primary/15 sm:w-64 sm:flex-none"
        />
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
              <AdminTh>Name</AdminTh>
              <AdminTh>User</AdminTh>
              <AdminTh>Type</AdminTh>
              <AdminTh className="tabular-nums">Size</AdminTh>
              <AdminTh className="hidden tabular-nums sm:table-cell">Project</AdminTh>
              <AdminTh className="tabular-nums">Uploaded</AdminTh>
            </tr>
          </AdminThead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-10 text-center text-xs text-muted-foreground"
                >
                  No files match these filters.
                </td>
              </tr>
            ) : (
              result.rows.map((f) => (
                <AdminTr key={f.id}>
                  <AdminTd className="font-mono">{f.file_name}</AdminTd>
                  <AdminTd>
                    <Link
                      href={`/admin/users/${f.user_id}`}
                      className="block leading-tight hover:underline"
                    >
                      <div className="font-medium">{f.full_name}</div>
                      <div className="truncate text-micro text-muted-foreground">
                        {f.email}
                      </div>
                    </Link>
                  </AdminTd>
                  <AdminTd className="font-mono text-xs text-muted-foreground">
                    {f.mime_type ?? "-"}
                  </AdminTd>
                  <AdminTd className="font-mono tabular-nums">
                    {formatBytes(f.file_size)}
                  </AdminTd>
                  <AdminTd className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {f.project_id ? shortenId(f.project_id) : "-"}
                  </AdminTd>
                  <AdminTd className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatRelative(f.created_at)}
                  </AdminTd>
                </AdminTr>
              ))
            )}
          </tbody>
        </AdminTable>
      </AdminTableShell>

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
