/**
 * /admin/jobs — scheduled-job health (Admin hardening A3).
 *
 *   - Per-job health cards: last run, status, duration, stale/failing flags.
 *   - Recent runs table across all jobs.
 *
 * Data source: the `cron_runs` registry every scheduled job writes to.
 */

import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
} from "lucide-react";
import { requireAdmin } from "@/features/admin/server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { getCronHealth, listCronRuns } from "@/features/admin/cron-queries";
import { formatRelative, formatIstStamp } from "@/features/admin/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  await requireAdmin();
  const [health, runs] = await Promise.all([getCronHealth(), listCronRuns(60)]);

  const problems = health.filter((h) => h.stale || h.failing).length;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Scheduled jobs"
        subtitle={
          problems > 0
            ? `${problems} job${problems === 1 ? "" : "s"} need attention`
            : "All jobs healthy"
        }
      />

      {/* Per-job health */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((h) => {
          const tone = h.failing ? "alert" : h.stale ? "warn" : "ok";
          const Icon = h.failing ? XCircle : h.stale ? AlertTriangle : CheckCircle2;
          return (
            <div
              key={h.id}
              className={cn(
                "rounded-lg border bg-card p-3.5",
                tone === "alert" && "border-red-500/30",
                tone === "warn" && "border-amber-500/30",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{h.label}</span>
                <Icon
                  className={cn(
                    "h-4 w-4",
                    tone === "alert"
                      ? "text-red-500"
                      : tone === "warn"
                        ? "text-amber-500"
                        : "text-emerald-500",
                  )}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {h.lastRun
                  ? `Last run ${formatRelative(h.lastRun.finished_at)} · ${h.lastRun.duration_ms}ms`
                  : "Never run"}
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-muted-foreground/80">{h.id}</p>
              {h.failing && h.lastRun?.error ? (
                <p className="mt-1.5 truncate text-[11px] text-red-600/90">{h.lastRun.error}</p>
              ) : h.stale ? (
                <p className="mt-1.5 text-[11px] text-amber-600/90">Overdue — no recent successful run.</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Recent runs */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Recent runs
        </h2>
        {runs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
            No runs recorded yet. Jobs register here on their next execution.
          </div>
        ) : (
          <ul className="divide-y divide-border/50 overflow-hidden rounded-lg border border-border/60 bg-card">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-2.5 text-xs">
                <span
                  className={cn(
                    "inline-flex h-2 w-2 shrink-0 rounded-full",
                    r.status === "ok" ? "bg-emerald-500" : "bg-red-500",
                  )}
                />
                <span className="w-48 truncate font-mono">{r.job}</span>
                <span className="w-16 tabular-nums text-muted-foreground">{r.duration_ms}ms</span>
                <span className="flex-1 truncate text-muted-foreground">
                  {r.status === "error" && r.error ? r.error : ""}
                </span>
                <span className="shrink-0 text-muted-foreground" title={formatIstStamp(r.finished_at)}>
                  {formatRelative(r.finished_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
