/**
 * Ivo chat-history retention cron.
 *
 *   GET /api/cron/ivo-retention
 *
 * Keeps ivo_messages storage linear and bounded:
 *   - Messages in ARCHIVED conversations older than RETENTION_DAYS are deleted.
 *   - The active conversation is never touched (resume + idempotency intact).
 *   - `ivo_runs` rows are kept — they are the compact quality/audit ledger and
 *     grow far more slowly than message bodies.
 *   - Long-term memory (`ivo_memories`) is never touched; it is capped per
 *     user and is the only store Ivo needs to "remember" across chats.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>` (same as other crons).
 * Safe to run daily; deletion is idempotent.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;
/** Delete in slices so a huge backlog can't blow the function timeout. */
const BATCH_SIZE = 2000;
const MAX_BATCHES = 25;

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
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  let deleted = 0;
  let batches = 0;
  try {
    for (; batches < MAX_BATCHES; batches++) {
      // Resolve a slice of prunable message ids: old messages whose parent
      // conversation is archived (inner-join filter, so no conversation
      // pagination edge cases). Two-step (select → delete by id) keeps the
      // delete simple under the admin client.
      const { data: prunable, error: selectError } = await admin
        .from("ivo_messages")
        .select("id, ivo_conversations!inner(status)")
        .eq("ivo_conversations.status", "archived")
        .lt("created_at", cutoff)
        .limit(BATCH_SIZE);
      if (selectError) throw selectError;
      const ids = ((prunable as Array<{ id: string }> | null) ?? []).map((row) => row.id);
      if (ids.length === 0) break;

      const { error: deleteError } = await admin
        .from("ivo_messages")
        .delete()
        .in("id", ids);
      if (deleteError) throw deleteError;
      deleted += ids.length;
      if (ids.length < BATCH_SIZE) break;
    }

    // Resolved prepared actions (approved/dismissed drafts) are transient by
    // nature — prune them after 30 days so the queue table stays small.
    const preparedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: preparedError } = await admin
      .from("ivo_prepared_actions")
      .delete()
      .in("status", ["approved", "dismissed"])
      .lt("updated_at", preparedCutoff);
    if (preparedError) throw preparedError;

    await recordCronRun({
      job: "ivo-retention",
      status: "ok",
      startedAtMs,
      detail: { deleted, batches, retentionDays: RETENTION_DAYS },
    });
    log.info("cron.ivo_retention.succeeded", { deleted, batches });
    return NextResponse.json({ ok: true, deleted, batches });
  } catch (error) {
    await recordCronRun({
      job: "ivo-retention",
      status: "error",
      startedAtMs,
      detail: { deleted, batches },
      error: error instanceof Error ? error.message : "unknown",
    }).catch(() => undefined);
    log.warn("cron.ivo_retention.failed", {
      error: error instanceof Error ? error.message : "unknown",
      deleted,
    });
    return NextResponse.json({ ok: false, deleted }, { status: 500 });
  }
}
