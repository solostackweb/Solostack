/**
 * /admin/audit - append-only log of every admin operation.
 *
 * Backed by `admin_actions` (migration 0019). Phase-1: simple
 * descending list with pagination. Filters (by actor, target, kind)
 * land in Phase 2 when the surface area justifies them.
 *
 * Why this matters: it's the first place to look when something
 * unexpected happens - "what did I do recently that might have caused
 * this?" The Now page already surfaces the most recent 10; this view
 * goes deeper.
 */

import Link from "next/link";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, EmptyState } from "@/components/admin/kit";
import { ClipboardList } from "lucide-react";
import { JsonViewer } from "@/components/admin/json-viewer";
import {
  formatIstStamp,
  formatRelative,
  shortenId,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";
import { log } from "@/lib/logger";
import type { AdminActionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const PAGE_SIZE = 50;

export default async function AdminAuditPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const admin = getAdminSupabase();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, count, error } = await admin
    .from("admin_actions")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    log.warn("admin.audit.page_load_failed", { error: error.message });
  }

  const rows = (data ?? []) as AdminActionRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminSection>
      <AdminPageHeader
        title="Audit log"
        subtitle={
          <span>
            {total.toLocaleString("en-IN")} actions - append-only - service-role only
          </span>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No admin actions yet">
          The audit log populates the first time you perform a write through the
          console.
        </EmptyState>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <AuditRow key={row.id} row={row} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </AdminSection>
  );
}

// ---------------------------------------------------------------------------

function AuditRow({ row }: { row: AdminActionRow }) {
  const meta = row.metadata as Record<string, unknown> | null;
  const hasMeta = meta && Object.keys(meta).length > 0;

  return (
    <li className="rounded-lg border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
            row.success ? "bg-success" : "bg-destructive",
          )}
          aria-hidden
        />
        <span className="font-medium">{row.kind}</span>
        <span className="text-muted-foreground">
          {row.target_type}
          {row.target_id ? ` - ${shortenId(row.target_id)}` : ""}
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono tabular-nums text-muted-foreground">
          <span>{row.duration_ms}ms</span>
          <span title={row.created_at}>{formatRelative(row.created_at)}</span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>actor {row.actor_id ? shortenId(row.actor_id) : "deleted user"}</span>
        {row.request_id ? <span>req {shortenId(row.request_id)}</span> : null}
        <span className="font-mono">{formatIstStamp(row.created_at)} IST</span>
      </div>
      {hasMeta ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            metadata
          </summary>
          <div className="mt-1">
            <JsonViewer value={meta} defaultExpandDepth={1} />
          </div>
        </details>
      ) : null}
    </li>
  );
}

function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <nav className="flex items-center justify-between text-xs">
      <Link
        href={`/admin/audit?page=${prev}`}
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
        href={`/admin/audit?page=${next}`}
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
