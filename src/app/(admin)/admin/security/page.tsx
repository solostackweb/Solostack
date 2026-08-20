/**
 * /admin/security - security_events viewer.
 *
 * Filters: severity, kind, request_id, user_id. Defaults to last 7
 * days (counts at top, all severities visible in the list).
 *
 * Each row expands its `metadata` JSONB in-place via JsonViewer.
 * Request-id is clickable: it filters the list to all events sharing
 * that request id (i.e. one end-to-end trace).
 */

import Link from "next/link";
import { Filter, X, ShieldAlert, AlertTriangle, Info } from "lucide-react";

import { listSecurityEvents } from "@/features/admin/queries";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminSection, EmptyState, KpiGrid, StatCard } from "@/components/admin/kit";
import { JsonViewer } from "@/components/admin/json-viewer";
import {
  formatIstStamp,
  formatRelative,
  shortenId,
} from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const SEVERITY_TABS = ["all", "alert", "warn", "info"] as const;
type Severity = (typeof SEVERITY_TABS)[number];

const KIND_OPTIONS = [
  "all",
  "auth_login_failed",
  "auth_signup_failed",
  "auth_ratelimit_tripped",
  "auth_password_reset_requested",
  "rls_guard_miss",
  "webhook_signature_invalid",
  "webhook_replay_detected",
  "storage_prefix_mismatch",
  "cron_monitor_alert",
  "suppression_hit",
  "other",
] as const;

export default async function AdminSecurityPage({ searchParams }: Props) {
  const sp = await searchParams;
  const severity = parseSeverity(asString(sp.severity)) ?? "all";
  const kind = (asString(sp.kind) as (typeof KIND_OPTIONS)[number]) ?? "all";
  const requestId = asString(sp.request_id);
  const userId = asString(sp.user_id);
  const page = Math.max(parseInt(asString(sp.page) ?? "1", 10) || 1, 1);

  const result = await listSecurityEvents({
    severity: severity === "all" ? "all" : severity,
    kind: kind === "all" ? "all" : kind,
    requestId,
    userId,
    page,
    pageSize: 50,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / 50));

  const filterActive = !!(
    requestId ||
    userId ||
    (kind && kind !== "all") ||
    (severity && severity !== "all")
  );

  return (
    <AdminSection>
      <AdminPageHeader
        title="Security"
        subtitle={
          <span>
            Last 7d -{" "}
            <span className="text-destructive-strong">
              {result.counts.alert} alert
            </span>{" "}
            -{" "}
            <span className="text-warning-strong">
              {result.counts.warn} warn
            </span>{" "}
            -{" "}
            <span className="text-muted-foreground">
              {result.counts.info} info
            </span>
          </span>
        }
      />

      <KpiGrid cols={3}>
        <StatCard href="/admin/security?severity=alert" icon={ShieldAlert} label="Alerts (7d)" value={result.counts.alert} tone={result.counts.alert > 0 ? "alert" : "ok"} />
        <StatCard href="/admin/security?severity=warn" icon={AlertTriangle} label="Warnings (7d)" value={result.counts.warn} tone={result.counts.warn > 0 ? "warn" : "ok"} />
        <StatCard href="/admin/security?severity=info" icon={Info} label="Info (7d)" value={result.counts.info} tone="neutral" />
      </KpiGrid>

      {/* Severity tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border/60 pb-1">
        {SEVERITY_TABS.map((s) => {
          const active = s === severity;
          return (
            <Link
              key={s}
              href={`/admin/security?severity=${s}`}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                active
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              {s}
            </Link>
          );
        })}
      </div>

      {/* Filters */}
      <form
        method="get"
        action="/admin/security"
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="severity" value={severity} />
        <select
          name="kind"
          defaultValue={kind}
          className="h-8 rounded border bg-background px-2 text-xs"
        >
          {KIND_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="request_id"
          defaultValue={requestId ?? ""}
          placeholder="Request id"
          className="h-8 w-44 rounded border bg-background px-2 font-mono text-xs"
        />
        <input
          type="text"
          name="user_id"
          defaultValue={userId ?? ""}
          placeholder="User id"
          className="h-8 w-44 rounded border bg-background px-2 font-mono text-xs"
        />
        <button
          type="submit"
          className="inline-flex h-8 items-center gap-1 rounded border bg-background px-3 text-xs hover:bg-accent"
        >
          <Filter className="h-3 w-3" />
          Apply
        </button>
        {filterActive ? (
          <Link
            href="/admin/security"
            className="inline-flex h-8 items-center gap-1 rounded border bg-background px-3 text-xs hover:bg-accent"
          >
            <X className="h-3 w-3" />
            Clear
          </Link>
        ) : null}
      </form>

      {/* Results */}
      <p className="text-xs text-muted-foreground">
        {result.total.toLocaleString("en-IN")} matches - page {page} /{" "}
        {totalPages}
      </p>

      {result.rows.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No events match">
          Try widening the filters or clearing the search.
        </EmptyState>
      ) : (
        <ul className="space-y-1.5">
          {result.rows.map((row) => {
            const meta = row.metadata as Record<string, unknown> | null;
            const hasMeta = meta && Object.keys(meta).length > 0;
            return (
              <li
                key={row.id}
                className="rounded-lg border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      row.severity === "alert"
                        ? "bg-destructive"
                        : row.severity === "warn"
                          ? "bg-warning"
                          : "bg-muted-foreground/50",
                    )}
                  />
                  <span className="font-medium">{row.kind}</span>
                  <span className="text-muted-foreground">
                    {row.severity}
                  </span>
                  <span className="ml-auto flex items-center gap-3 text-muted-foreground">
                    {row.request_id ? (
                      <Link
                        href={`/admin/security?request_id=${row.request_id}`}
                        className="font-mono hover:text-foreground"
                        title={`Filter to request ${row.request_id}`}
                      >
                        req {shortenId(row.request_id)}
                      </Link>
                    ) : null}
                    {row.user_id ? (
                      <Link
                        href={`/admin/users/${row.user_id}`}
                        className="font-mono hover:text-foreground"
                      >
                        user {shortenId(row.user_id)}
                      </Link>
                    ) : null}
                    <span
                      className="font-mono tabular-nums"
                      title={row.created_at}
                    >
                      {formatRelative(row.created_at)}
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">
                    {formatIstStamp(row.created_at)} IST
                  </span>
                  {row.ip ? (
                    <span className="font-mono">ip {row.ip}</span>
                  ) : null}
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
          })}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-xs">
          <PageLink
            page={Math.max(1, page - 1)}
            sp={{ severity, kind, request_id: requestId, user_id: userId }}
            disabled={page === 1}
          >
            Prev
          </PageLink>
          <span className="text-muted-foreground tabular-nums">
            Page {page} / {totalPages}
          </span>
          <PageLink
            page={Math.min(totalPages, page + 1)}
            sp={{ severity, kind, request_id: requestId, user_id: userId }}
            disabled={page === totalPages}
          >
            Next
          </PageLink>
        </nav>
      ) : null}
    </AdminSection>
  );
}

function PageLink({
  page,
  sp,
  disabled,
  children,
}: {
  page: number;
  sp: {
    severity: Severity;
    kind: string;
    request_id?: string;
    user_id?: string;
  };
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded border px-2 py-1 opacity-40">{children}</span>
    );
  }
  const params = new URLSearchParams();
  params.set("severity", sp.severity);
  params.set("kind", sp.kind);
  params.set("page", String(page));
  if (sp.request_id) params.set("request_id", sp.request_id);
  if (sp.user_id) params.set("user_id", sp.user_id);
  return (
    <Link
      href={`/admin/security?${params.toString()}`}
      className="rounded border px-2 py-1 hover:bg-accent"
    >
      {children}
    </Link>
  );
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseSeverity(v: string | undefined): Severity | undefined {
  return (SEVERITY_TABS as readonly string[]).includes(v ?? "")
    ? (v as Severity)
    : undefined;
}
