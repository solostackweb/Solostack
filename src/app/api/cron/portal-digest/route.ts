/**
 * Weekly portal digest cron.
 *
 *   GET /api/cron/portal-digest
 *
 * Runs once a week. For every active portal, emails the client a summary of
 * the last 7 days (updates, files, messages, upcoming meetings). Portals with
 * no activity are skipped (no empty digests).
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 * Idempotency: keyed `portal_digest:<portalId>:<runDate>` so a same-day retry
 * cannot double-send.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { dispatchPortalWeeklyDigest } from "@/features/portals/email";

import { recordCronRun } from "@/lib/cron/record";

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

  const admin = getAdminSupabase();

  const startedAtMs = Date.now();
  const { data, error } = await admin
    .from("portals")
    .select("id")
    .eq("status", "active")
    .is("deleted_at", null);
  if (error) {
    await recordCronRun({ job: "portal-digest", status: "error", startedAtMs, error: error.message });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const runDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const portals = (data ?? []) as Array<{ id: string }>;

  let sent = 0;
  let skipped = 0;
  for (const p of portals) {
    const res = await dispatchPortalWeeklyDigest({
      portalId: p.id,
      idempotencyKey: `portal_digest:${p.id}:${runDate}`,
    });
    if (res.sent) sent += 1;
    else skipped += 1;
  }

  log.info("portal_digest_cron", { portals: portals.length, sent, skipped });
  await recordCronRun({ job: "portal-digest", status: "ok", startedAtMs });
  return NextResponse.json({ ok: true, portals: portals.length, sent, skipped });
}
