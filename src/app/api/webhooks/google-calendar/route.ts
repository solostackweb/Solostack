/**
 * Google Calendar push-notification receiver (sync-back).
 *
 *   POST /api/webhooks/google-calendar
 *
 * Google sends headers only — no payload. `sync` is the handshake ping when
 * a channel opens; anything else means "something changed", so we pull the
 * incremental diff with the stored sync token and apply it.
 *
 * Authentication is the per-channel secret echoed in X-Goog-Channel-Token
 * plus the resource id, both checked against calendar_connections. Always
 * answers 200 — Google retries 4xx/5xx aggressively, and a poison retry
 * loop is worse than a logged miss.
 *
 * Ops note: the notification address must be public HTTPS on a Google-verified
 * domain or the watch request is rejected at creation time.
 */

import { NextResponse } from "next/server";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { accessTokenForBooking } from "@/features/scheduling/server";
import {
  applyChangedEvents,
  verifyChannelDelivery,
} from "@/features/scheduling/sync";
import { listChangedEvents } from "@/features/scheduling/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const channelId = req.headers.get("x-goog-channel-id") ?? "";
  const channelToken = req.headers.get("x-goog-channel-token") ?? "";
  const resourceId = req.headers.get("x-goog-resource-id");
  const resourceState = req.headers.get("x-goog-resource-state") ?? "";

  if (!channelId || !channelToken) {
    return new NextResponse("ok", { status: 200 });
  }

  const verified = await verifyChannelDelivery({
    channelId,
    token: channelToken,
    resourceId,
  });
  if (!verified) {
    log.warn("calendar_sync.webhook_rejected", { channelId });
    return new NextResponse("ok", { status: 200 });
  }

  // Handshake ping from a fresh watch — nothing to pull.
  if (resourceState === "sync") {
    return new NextResponse("ok", { status: 200 });
  }

  try {
    const admin = getAdminSupabase();
    const { data: row } = await admin
      .from("calendar_connections")
      .select("sync_token")
      .eq("user_id", verified.userId)
      .maybeSingle();
    const syncToken =
      (row as { sync_token: string | null } | null)?.sync_token ?? null;

    const token = await accessTokenForBooking(verified.userId);
    if (!token) return new NextResponse("ok", { status: 200 });

    const diff = await listChangedEvents(token, { syncToken });
    if (!diff.ok) {
      log.error("calendar_sync.webhook_list_failed", { channelId });
      return new NextResponse("ok", { status: 200 });
    }
    if (diff.expired) {
      // Token expired mid-flight: reseed without applying, next delivery
      // diffs from the fresh baseline.
      const seed = await listChangedEvents(token, {});
      if (seed.ok && !seed.expired && seed.nextSyncToken) {
        await admin
          .from("calendar_connections")
          .update({ sync_token: seed.nextSyncToken } as never)
          .eq("user_id", verified.userId);
      }
      return new NextResponse("ok", { status: 200 });
    }

    const applied = await applyChangedEvents(verified.userId, diff.items);
    if (diff.nextSyncToken) {
      await admin
        .from("calendar_connections")
        .update({ sync_token: diff.nextSyncToken } as never)
        .eq("user_id", verified.userId);
    }
    log.info("calendar_sync.webhook_applied", { channelId, ...applied });
  } catch (err) {
    log.error("calendar_sync.webhook_failed", {
      channelId,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
  return new NextResponse("ok", { status: 200 });
}
