/**
 * Account purge cron — the hard-delete half of the deletion flow (LC4).
 *
 *   GET /api/cron/account-purge   (daily)
 *
 * Finds accounts whose 30-day deletion grace window has elapsed and
 * permanently erases them:
 *   1. Delete the user's portal files from R2 (object storage isn't FK-linked
 *      to the DB, so it must be purged explicitly).
 *   2. Delete the auth user. Because almost every user-owned table is
 *      `ON DELETE CASCADE` from auth.users, this hard-removes the profile,
 *      clients, projects, invoices, contracts, time entries, portals, support
 *      threads, AI history, consents, push subscriptions, etc. — true erasure.
 *      Audit/billing rows that are `ON DELETE SET NULL` survive with the
 *      user reference nulled (anonymized) — these are the platform's own
 *      records retained for its tax/audit obligations.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 */

import { NextResponse } from "next/server";
import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/security-events/server";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PER_RUN = 25; // bound work per invocation

async function purgePortalFiles(userId: string): Promise<number> {
  const admin = getAdminSupabase();
  let deleted = 0;
  try {
    const { data: portals } = await admin
      .from("portals")
      .select("id")
      .eq("owner_user_id", userId);
    const portalIds = (portals ?? []).map((p) => (p as { id: string }).id);
    if (portalIds.length === 0) return 0;

    const { data: files } = await admin
      .from("portal_files")
      .select("r2_key")
      .in("portal_id", portalIds);
    const keys = (files ?? [])
      .map((f) => (f as { r2_key: string | null }).r2_key)
      .filter((k): k is string => !!k);
    if (keys.length === 0) return 0;

    const { deleteObject, isR2Configured } = await import("@/lib/r2/client");
    if (!isR2Configured()) return 0;
    for (const key of keys) {
      try {
        await deleteObject(key);
        deleted += 1;
      } catch (err) {
        log.warn("cron.account_purge.r2_delete_failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    log.warn("cron.account_purge.file_enum_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return deleted;
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
  let purged = 0;
  let hadError = false;

  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await admin
      .from("user_profiles")
      .select("id")
      .eq("deletion_status", "pending_deletion")
      .lte("deletion_scheduled_at", nowIso)
      .limit(MAX_PER_RUN);

    const ids = (due ?? []).map((r) => (r as { id: string }).id);

    for (const userId of ids) {
      try {
        await purgePortalFiles(userId);

        // Audit the purge BEFORE deletion (event user_id is ON DELETE SET
        // NULL, so the row survives the cascade as an anonymized record).
        await recordSecurityEvent({
          kind: "account_purged",
          severity: "warn",
          userId,
          metadata: { reason: "grace_period_elapsed" },
        });

        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) {
          hadError = true;
          log.error("cron.account_purge.delete_user_failed", {
            error: error.message,
          });
          continue;
        }
        purged += 1;
      } catch (err) {
        hadError = true;
        log.error("cron.account_purge.user_exception", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    hadError = true;
    log.error("cron.account_purge.scan_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await recordCronRun({
    job: "account-purge",
    status: hadError ? "error" : "ok",
    startedAtMs,
    detail: { purged },
    error: hadError ? "one or more accounts failed to purge" : null,
  });

  log.info("cron.account_purge.completed", { purged });
  return NextResponse.json({ ok: !hadError, purged, time: new Date().toISOString() });
}
