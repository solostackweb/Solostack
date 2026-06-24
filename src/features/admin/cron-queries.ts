import "server-only";

/**
 * Cron-run health reads for the founder console (Admin hardening A3).
 * Service-role only; callers are behind requireAdmin().
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CronJob } from "@/lib/cron/record";

/** Known jobs + expected cadence (used to flag a job as "stale/overdue"). */
export const CRON_JOBS: { id: CronJob; label: string; maxGapMinutes: number }[] = [
  { id: "monitor", label: "Operational monitor", maxGapMinutes: 60 },
  { id: "invoices-due-soon", label: "Invoice due-soon reminders", maxGapMinutes: 26 * 60 },
  { id: "invoices-overdue", label: "Overdue invoice reminders", maxGapMinutes: 26 * 60 },
  { id: "subscription-renewals", label: "Subscription renewals", maxGapMinutes: 26 * 60 },
  { id: "admin-export", label: "Admin export", maxGapMinutes: 26 * 60 },
  { id: "portal-digest", label: "Weekly portal digest", maxGapMinutes: 8 * 24 * 60 },
  { id: "retention", label: "Data retention cleanup", maxGapMinutes: 26 * 60 },
  { id: "account-purge", label: "Account purge (deletion grace)", maxGapMinutes: 26 * 60 },
];

export interface CronRunRow {
  id: string;
  job: string;
  status: "ok" | "error";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  detail: Record<string, unknown>;
  error: string | null;
  created_at: string;
}

export interface CronJobHealth {
  id: CronJob;
  label: string;
  lastRun: CronRunRow | null;
  /** No successful run within the expected cadence (or never ran). */
  stale: boolean;
  /** Most recent run errored. */
  failing: boolean;
}

/** Per-job health: latest run + stale/failing flags. */
export async function getCronHealth(): Promise<CronJobHealth[]> {
  const admin = getAdminSupabase();
  const now = Date.now();

  const health = await Promise.all(
    CRON_JOBS.map(async (job) => {
      const { data } = await admin
        .from("cron_runs")
        .select("*")
        .eq("job", job.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastRun = (data as CronRunRow | null) ?? null;

      const lastOkAt = lastRun && lastRun.status === "ok" ? Date.parse(lastRun.finished_at) : null;
      const stale = lastOkAt === null || now - lastOkAt > job.maxGapMinutes * 60_000;
      const failing = lastRun?.status === "error";

      return { id: job.id, label: job.label, lastRun, stale, failing };
    }),
  );

  return health;
}

/** Recent runs across all jobs (newest first), for the /admin/jobs table. */
export async function listCronRuns(limit = 60): Promise<CronRunRow[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("cron_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));
  return (data as CronRunRow[] | null) ?? [];
}

/** Compact summary for the Now page (count of stale/failing jobs). */
export async function getCronHealthSummary(): Promise<{
  stale: number;
  failing: number;
  total: number;
}> {
  const health = await getCronHealth();
  return {
    stale: health.filter((h) => h.stale).length,
    failing: health.filter((h) => h.failing).length,
    total: health.length,
  };
}
