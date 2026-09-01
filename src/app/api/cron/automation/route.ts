/**
 * Automation evaluator cron.
 *
 *   GET /api/cron/automation
 *
 * Runs the Phase 4 evaluator for every user who has an enabled recipe, so
 * date-based moments (overdue invoice, due-soon invoice, quiet proposal,
 * expiring contract) and unbilled time materialize as queued `automation_runs`
 * + `automation_suggestions` even when no one opened the dashboard.
 *
 * This route ONLY EVALUATES and materializes queued runs — it never executes
 * a delivery. Execution is approval-gated and session-scoped (the user clicks
 * "Approve & run" in the dashboard), because the underlying domain operations
 * are bound to the signed-in session and the whole point of Phase 4 is that
 * nothing leaves the workspace without explicit approval.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 * Idempotent by construction: refreshForUser() upserts runs on
 * (user_id, trigger_key, dedupe_key) and skips suggestions already live.
 */

import { NextResponse } from "next/server";

import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listAutomationUserIds, refreshForUser } from "@/features/automation/refresh-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminUnbilled(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ totalAmount: number; totalSeconds: number } | null> {
  const { data } = await supabase
    .from("time_entries")
    .select("amount, duration_seconds")
    .eq("user_id", userId)
    .eq("billable", true)
    .is("invoice_id", null)
    .not("ended_at", "is", null)
    .limit(1000);
  const rows = (data as Array<{ amount: number | null; duration_seconds: number }> | null) ?? [];
  let totalAmount = 0;
  let totalSeconds = 0;
  for (const row of rows) {
    totalAmount += Number(row.amount) || 0;
    totalSeconds += Number(row.duration_seconds) || 0;
  }
  return { totalAmount: Math.round(totalAmount * 100) / 100, totalSeconds };
}

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) return new NextResponse("Not configured", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAtMs = Date.now();
  const admin = getAdminSupabase();

  let evaluated = 0;
  let suggestions = 0;
  let errored = 0;

  try {
    const userIds = await listAutomationUserIds(admin);
    for (const userId of userIds) {
      try {
        const result = await refreshForUser(admin, userId, () =>
          adminUnbilled(admin, userId),
        );
        evaluated += 1;
        suggestions += result.suggestions.length;
      } catch (error) {
        errored += 1;
        log.warn("cron.automation.user_failed", {
          userId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("cron.automation.list_failed", { error: message });
    await recordCronRun({
      job: "automation",
      status: "error",
      startedAtMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  log.info("cron.automation.summary", { evaluated, suggestions, errored });
  await recordCronRun({
    job: "automation",
    status: "ok",
    startedAtMs,
    detail: { evaluated, suggestions, errored },
  });

  return NextResponse.json({
    ok: true,
    evaluated,
    suggestions,
    errored,
    time: new Date().toISOString(),
  });
}