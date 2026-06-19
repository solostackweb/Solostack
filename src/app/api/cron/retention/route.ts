/**
 * Data-retention cleanup cron (Admin hardening A6).
 *
 *   GET /api/cron/retention   (daily)
 *
 * Prunes high-churn operational tables so they stay fast at scale. Forensic
 * tables (security_events, admin_actions) keep a long window; transient logs
 * are trimmed aggressively.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Retention windows (days) per table. */
const RETENTION_DAYS: Record<string, number> = {
  delivery_logs: 180,
  cron_runs: 30,
  security_events: 365,
  admin_actions: 730,
};

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) return new NextResponse("Not configured", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAtMs = Date.now();
  const admin = getAdminSupabase();
  const pruned: Record<string, number> = {};
  let hadError = false;

  for (const [table, days] of Object.entries(RETENTION_DAYS)) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    try {
      const { error, count } = await admin
        .from(table)
        .delete({ count: "estimated" })
        .lt("created_at", cutoff);
      if (error) {
        hadError = true;
        log.warn("cron.retention.delete_failed", { table, error: error.message });
      } else {
        pruned[table] = count ?? 0;
      }
    } catch (err) {
      hadError = true;
      log.warn("cron.retention.delete_exception", {
        table,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await recordCronRun({
    job: "retention",
    status: hadError ? "error" : "ok",
    startedAtMs,
    detail: { pruned },
    error: hadError ? "one or more tables failed to prune" : null,
  });

  log.info("cron.retention.completed", { pruned });
  return NextResponse.json({ ok: !hadError, pruned, time: new Date().toISOString() });
}
