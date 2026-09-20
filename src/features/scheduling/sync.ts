import "server-only";

import crypto from "node:crypto";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { env } from "@/config/env";
import { log } from "@/lib/logger";
import { accessTokenForBooking } from "./server";
import { decryptToken, encryptToken } from "./crypto";
import {
  listChangedEvents,
  stopCalendarChannel,
  watchCalendarChannel,
  type ChangedEvent,
} from "./google";

/**
 * Calendar sync-back: Google → Stackivo.
 *
 * Edits made directly in Google Calendar (move, rename, delete) would
 * otherwise orphan the linked meeting rows. A push channel on the primary
 * calendar tells the webhook something changed; the webhook pulls the
 * incremental diff and this module applies it.
 *
 * Self-induced changes are naturally ignored: every Stackivo action writes
 * the DB *before* touching Google, so by the time the notification arrives
 * the row already matches and the equality compares below skip it. Cancels
 * additionally clear `google_event_id`, so our own deletions never match.
 */

export const WEBHOOK_PATH = "/api/webhooks/google-calendar";

/** Channels live 7 days; the daily cron renews inside this window. */
const RENEW_WITHIN_MS = 48 * 60 * 60 * 1000;
const CHANNEL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function webhookUrl(): string {
  return `${env.appUrl.replace(/\/$/, "")}${WEBHOOK_PATH}`;
}

interface WatchRow {
  refresh_token: string | null;
  watch_channel_id: string | null;
  watch_channel_token: string | null;
  watch_resource_id: string | null;
  watch_expiration: string | null;
  sync_token: string | null;
}

async function readWatchRow(userId: string): Promise<WatchRow | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_connections")
    .select(
      "refresh_token, watch_channel_id, watch_channel_token, watch_resource_id, watch_expiration, sync_token",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as WatchRow | null) ?? null;
}

/**
 * Ensure a live push channel + seeded sync token. Returns whether a new
 * channel was opened. Safe to call on every connect and from the daily cron.
 */
export async function ensureWatchForUser(
  userId: string,
): Promise<{ ok: boolean; renewed: boolean; error?: string }> {
  const row = await readWatchRow(userId);
  if (!row?.refresh_token) {
    return { ok: false, renewed: false, error: "Calendar not connected." };
  }

  const expiresAt = row.watch_expiration
    ? new Date(row.watch_expiration).getTime()
    : 0;
  if (row.watch_channel_id && expiresAt - Date.now() > RENEW_WITHIN_MS) {
    return { ok: true, renewed: false };
  }

  const token = await accessTokenForBooking(userId);
  if (!token) {
    return { ok: false, renewed: false, error: "Could not reach Google." };
  }

  // Retire the old channel so it stops delivering (best-effort).
  if (row.watch_channel_id) {
    await stopCalendarChannel(token, {
      channelId: row.watch_channel_id,
      resourceId: row.watch_resource_id,
    }).catch(() => false);
  }

  const channelToken = crypto.randomUUID();
  const watch = await watchCalendarChannel(token, {
    address: webhookUrl(),
    token: channelToken,
    expirationMs: Date.now() + CHANNEL_TTL_MS,
  });
  if (!watch) {
    return { ok: false, renewed: false, error: "Google rejected the watch request." };
  }

  // Seed the sync token from recent history without applying anything —
  // whatever already happened out there is the baseline, not a change.
  const seed = await listChangedEvents(token, {});
  const syncToken =
    seed.ok && !seed.expired ? (seed.nextSyncToken ?? null) : null;

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("calendar_connections")
    .update({
      watch_channel_id: watch.channelId,
      watch_channel_token: encryptToken(channelToken),
      watch_resource_id: watch.resourceId,
      watch_expiration: watch.expirationMs
        ? new Date(watch.expirationMs).toISOString()
        : new Date(Date.now() + CHANNEL_TTL_MS).toISOString(),
      sync_token: syncToken,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", userId);

  if (error) {
    log.error("calendar_sync.watch_save_failed", { error: error.message });
    return { ok: false, renewed: false, error: error.message };
  }
  return { ok: true, renewed: true };
}

/** Close the push channel and clear its state (used on disconnect). */
export async function stopWatchForUser(userId: string): Promise<void> {
  try {
    const row = await readWatchRow(userId);
    if (row?.watch_channel_id) {
      const token = await accessTokenForBooking(userId);
      if (token) {
        await stopCalendarChannel(token, {
          channelId: row.watch_channel_id,
          resourceId: row.watch_resource_id,
        }).catch(() => false);
      }
    }
    const admin = getAdminSupabase();
    await admin
      .from("calendar_connections")
      .update({
        watch_channel_id: null,
        watch_channel_token: null,
        watch_resource_id: null,
        watch_expiration: null,
        sync_token: null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", userId);
  } catch {
    /* disconnect must never fail because of watch cleanup */
  }
}

async function notifyOwner(input: {
  userId: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  href: string;
}): Promise<void> {
  try {
    const admin = getAdminSupabase();
    await admin.from("notifications").insert({
      user_id: input.userId,
      title: input.title,
      body: input.body,
      type: "meeting_external_change",
      entity_type: input.entityType,
      entity_id: input.entityId,
      href: input.href,
    } as never);
  } catch {
    /* notification is secondary to the data fix */
  }
}

/**
 * Apply one incremental diff. Returns counts for the webhook/cron summary.
 * Every branch compares before writing, so re-deliveries are no-ops.
 */
export async function applyChangedEvents(
  userId: string,
  items: ChangedEvent[],
): Promise<{ cancelled: number; moved: number; renamed: number; ignored: number }> {
  const admin = getAdminSupabase();
  let cancelled = 0;
  let moved = 0;
  let renamed = 0;
  let ignored = 0;

  for (const event of items) {
    // Main meetings first.
    const { data: meeting } = await admin
      .from("meetings")
      .select("id, status, scheduled_at, topic, google_event_id")
      .eq("user_id", userId)
      .eq("google_event_id", event.id)
      .maybeSingle();
    const main = meeting as {
      id: string;
      status: string;
      scheduled_at: string | null;
      topic: string;
    } | null;

    if (main) {
      if (event.status === "cancelled") {
        if (main.status === "proposed" || main.status === "confirmed") {
          await admin
            .from("meetings")
            .update({
              status: "cancelled",
              google_event_id: null,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", main.id);
          cancelled += 1;
          await notifyOwner({
            userId,
            title: `${main.topic} was cancelled on Google Calendar`,
            body: "The calendar event was deleted outside Stackivo, so the meeting was marked cancelled here too.",
            entityType: "meeting",
            entityId: main.id,
            href: `/dashboard/meetings/${main.id}`,
          });
        } else {
          ignored += 1;
        }
        continue;
      }

      if (main.status !== "proposed" && main.status !== "confirmed") {
        ignored += 1;
        continue;
      }

      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      let timeChanged = false;
      if (
        event.startIso &&
        main.scheduled_at &&
        new Date(event.startIso).getTime() !== new Date(main.scheduled_at).getTime()
      ) {
        patch.scheduled_at = event.startIso;
        timeChanged = true;
      }
      let titleChanged = false;
      if (event.summary && event.summary !== main.topic) {
        patch.topic = event.summary;
        titleChanged = true;
      }
      if (!timeChanged && !titleChanged) {
        ignored += 1;
        continue;
      }
      await admin.from("meetings").update(patch as never).eq("id", main.id);
      if (timeChanged) {
        moved += 1;
        await notifyOwner({
          userId,
          title: `${main.topic} moved on Google Calendar`,
          body: "The event time changed outside Stackivo — the meeting here now matches the new time.",
          entityType: "meeting",
          entityId: main.id,
          href: `/dashboard/meetings/${main.id}`,
        });
      } else {
        renamed += 1;
      }
      continue;
    }

    // Portal meetings: same rules, after confirming this user owns the portal.
    const { data: portalMeeting } = await admin
      .from("portal_meetings")
      .select("id, portal_id, status, scheduled_at, topic, google_event_id")
      .eq("google_event_id", event.id)
      .maybeSingle();
    const pm = portalMeeting as {
      id: string;
      portal_id: string;
      status: string;
      scheduled_at: string | null;
      topic: string;
    } | null;

    if (!pm) {
      ignored += 1;
      continue;
    }
    const { data: portal } = await admin
      .from("portals")
      .select("owner_user_id")
      .eq("id", pm.portal_id)
      .maybeSingle();
    if ((portal as { owner_user_id: string } | null)?.owner_user_id !== userId) {
      ignored += 1;
      continue;
    }

    if (event.status === "cancelled") {
      if (pm.status === "pending" || pm.status === "accepted") {
        await admin
          .from("portal_meetings")
          .update({
            status: "cancelled",
            google_event_id: null,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", pm.id);
        cancelled += 1;
        await notifyOwner({
          userId,
          title: `${pm.topic} was cancelled on Google Calendar`,
          body: "The calendar event was deleted outside Stackivo, so the portal call was marked cancelled too.",
          entityType: "portal_meeting",
          entityId: pm.id,
          href: `/dashboard/portal/${pm.portal_id}`,
        });
      } else {
        ignored += 1;
      }
      continue;
    }

    if (pm.status !== "pending" && pm.status !== "accepted") {
      ignored += 1;
      continue;
    }
    if (
      event.startIso &&
      pm.scheduled_at &&
      new Date(event.startIso).getTime() !== new Date(pm.scheduled_at).getTime()
    ) {
      await admin
        .from("portal_meetings")
        .update({
          scheduled_at: event.startIso,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", pm.id);
      moved += 1;
      await notifyOwner({
        userId,
        title: `${pm.topic} moved on Google Calendar`,
        body: "The event time changed outside Stackivo — the portal call now matches the new time.",
        entityType: "portal_meeting",
        entityId: pm.id,
        href: `/dashboard/portal/${pm.portal_id}`,
      });
    } else {
      ignored += 1;
    }
  }

  return { cancelled, moved, renamed, ignored };
}

/** Verify an incoming webhook delivery against the stored channel. */
export async function verifyChannelDelivery(input: {
  channelId: string;
  token: string;
  resourceId: string | null;
}): Promise<{ userId: string } | null> {
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from("calendar_connections")
      .select("user_id, watch_channel_token, watch_resource_id")
      .eq("watch_channel_id", input.channelId)
      .maybeSingle();
    const row = data as {
      user_id: string;
      watch_channel_token: string | null;
      watch_resource_id: string | null;
    } | null;
    if (!row?.watch_channel_token) return null;
    const stored = decryptToken(row.watch_channel_token);
    if (!stored || stored !== input.token) return null;
    if (
      row.watch_resource_id &&
      input.resourceId &&
      row.watch_resource_id !== input.resourceId
    ) {
      return null;
    }
    return { userId: row.user_id };
  } catch {
    return null;
  }
}
