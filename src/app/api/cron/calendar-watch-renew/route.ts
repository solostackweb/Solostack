/**
 * Calendar watch renewal cron.
 *
 *   GET /api/cron/calendar-watch-renew
 *
 * Google push channels expire (ours are opened for 7 days). This job runs
 * daily and re-opens any channel missing or expiring within 48h, re-seeding
 * the sync token each time. Without it, sync-back silently stops a week
 * after connecting.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextResponse } from "next/server";

import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";
import { ensureWatchForUser } from "@/features/scheduling/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAtMs = Date.now();
  const admin = getAdminSupabase();

  try {
    const { data } = await admin
      .from("calendar_connections")
      .select("user_id, watch_expiration")
      .not("refresh_token", "is", null);
    const rows = (data ?? []) as Array<{
      user_id: string;
      watch_expiration: string | null;
    }>;

    let renewed = 0;
    let fresh = 0;
    let failed = 0;

    for (const row of rows) {
      const expiresAt = row.watch_expiration
        ? new Date(row.watch_expiration).getTime()
        : 0;
      if (expiresAt - Date.now() > 48 * 60 * 60 * 1000) {
        fresh += 1;
        continue;
      }
      const res = await ensureWatchForUser(row.user_id).catch(() => ({
        ok: false as const,
        renewed: false,
      }));
      if (res.ok && res.renewed) renewed += 1;
      else if (res.ok) fresh += 1;
      else failed += 1;
    }

    log.info("cron.calendar_watch_renew.summary", { renewed, fresh, failed });
    await recordCronRun({
      job: "calendar-watch-renew",
      status: "ok",
      startedAtMs,
      detail: { renewed, fresh, failed },
    });
    return NextResponse.json({ ok: true, renewed, fresh, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("cron.calendar_watch_renew.failed", { error: message });
    await recordCronRun({
      job: "calendar-watch-renew",
      status: "error",
      startedAtMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
