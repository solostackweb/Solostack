/**
 * Hourly export of `admin_actions` to the `admin-exports` storage
 * bucket for tamper-evidence.
 *
 * Path layout:
 *
 *   admin-exports/YYYY/MM/DD/HH.jsonl
 *
 * Why JSONL: one row per line means partial reads via the Supabase
 * Storage byte-range API stay trivial — useful when an export grows
 * past a few MB.
 *
 * Auth: same Bearer `CRON_SECRET` pattern as the other cron route.
 * Misconfigured CRON_SECRET → 404 (endpoint is effectively disabled).
 *
 * Idempotency: this route uses `upsert: true` on the storage upload,
 * so re-running it for the same hour overwrites with the same data.
 * (The set of admin_actions in a closed hour never changes — append-
 * only table.)
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "admin-exports";

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();

  // Auth gate.
  if (!env.cronSecret) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = getAdminSupabase();

  const startedAtMs = Date.now();

  // Snapshot the previous full hour. Running at HH:05 captures HH-1.
  const now = new Date();
  const start = new Date(now);
  start.setUTCMinutes(0, 0, 0);
  start.setUTCHours(start.getUTCHours() - 1);
  const end = new Date(start);
  end.setUTCHours(end.getUTCHours() + 1);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // Pull every row in the hour. Single page — admin write volume is
  // expected to be << 10k/hr for the foreseeable future. If this ever
  // crosses the cap we'll batch by id range.
  const { data, error } = await admin
    .from("admin_actions")
    .select("*")
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: true })
    .limit(10_000);

  if (error) {
    log.warn("admin.export.fetch_failed", { error: error.message });
    await recordCronRun({ job: "admin-export", status: "error", startedAtMs, error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (data ?? []) as unknown[];
  const jsonl = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";

  const yyyy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(start.getUTCDate()).padStart(2, "0");
  const hh = String(start.getUTCHours()).padStart(2, "0");
  const path = `${yyyy}/${mm}/${dd}/${hh}.jsonl`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, jsonl, {
      contentType: "application/x-ndjson",
      upsert: true,
    });

  if (uploadErr) {
    log.warn("admin.export.upload_failed", {
      path,
      error: uploadErr.message,
    });
    await recordCronRun({ job: "admin-export", status: "error", startedAtMs, error: uploadErr.message });
    return NextResponse.json(
      { ok: false, error: uploadErr.message },
      { status: 500 },
    );
  }

  log.info("admin.export.completed", {
    path,
    row_count: rows.length,
    window_start: startIso,
    window_end: endIso,
  });

  await recordCronRun({ job: "admin-export", status: "ok", startedAtMs });
  return NextResponse.json({
    ok: true,
    path,
    row_count: rows.length,
    window_start: startIso,
    window_end: endIso,
  });
}
