import "server-only";

/**
 * Cron-run registry writer (Admin hardening A3).
 *
 * Every scheduled job calls recordCronRun() once it finishes (success or
 * failure) so /admin/jobs can show last-run / status / duration and alert on
 * silent failures. Best-effort: a write failure here never affects the job.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

export type CronStatus = "ok" | "error";

/** Canonical job ids — keep in sync with the GitHub Actions workflow. */
export type CronJob =
  | "invoices-due-soon"
  | "invoices-overdue"
  | "subscription-renewals"
  | "admin-export"
  | "monitor"
  | "portal-digest"
  | "retention"
  | "ivo-retention"
  | "account-purge";

export async function recordCronRun(input: {
  job: CronJob;
  status: CronStatus;
  startedAtMs: number;
  detail?: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  try {
    const admin = getAdminSupabase();
    await admin.from("cron_runs").insert({
      job: input.job,
      status: input.status,
      started_at: new Date(input.startedAtMs).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Math.max(0, Date.now() - input.startedAtMs),
      detail: input.detail ?? {},
      error: input.error ?? null,
    } as never);
  } catch (err) {
    log.warn("cron.record_run_failed", {
      job: input.job,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
