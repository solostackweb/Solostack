/**
 * Pre-call meeting reminder cron.
 *
 *   GET /api/cron/meeting-reminders
 *
 * Runs hourly. Emails the client a heads-up before a confirmed call, in two
 * windows:
 *   ~24h before → "Tomorrow: <topic>"
 *   ~1h  before → "Starting soon: <topic>" (leads with the Meet button)
 *
 * Why the client and not the freelancer: the call already lives on the
 * freelancer's Google Calendar, so Google reminds them. The client only has
 * whatever we sent them, and if they never added the invite they have nothing.
 *
 * Covers both meeting systems — the main `meetings` table and portal meeting
 * requests. A reminder that only covered half the calls would be worse than
 * none, because you'd learn to trust it.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Idempotency: keyed on `meeting-reminder:<id>:<window>` so an hourly rerun,
 * a retry, or an overlapping window can never double-send.
 */

import { NextResponse } from "next/server";

import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";
import { dispatchDelivery } from "@/features/email/send";
import {
  buildEmailBrand,
  renderMeetingReminderEmail,
  type EmailBrand,
} from "@/features/email/templates";
import { resolveEmailLogoUrl } from "@/features/email/logo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReminderWindow = "tomorrow" | "soon";

/**
 * Each window is a span, not an instant: the job runs hourly, so it has to
 * catch everything starting inside the next hour-wide slice. Spans are
 * deliberately non-overlapping so a call can't match both in one run.
 */
const WINDOWS: Array<{
  window: ReminderWindow;
  fromMinutes: number;
  toMinutes: number;
}> = [
  { window: "tomorrow", fromMinutes: 23 * 60, toMinutes: 25 * 60 },
  { window: "soon", fromMinutes: 30, toMinutes: 90 },
];

interface OwnerContact {
  name: string;
  email: string | null;
  brand: EmailBrand;
}

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
  const ownerCache = new Map<string, OwnerContact>();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  try {
    for (const slice of WINDOWS) {
      const from = new Date(startedAtMs + slice.fromMinutes * 60_000);
      const to = new Date(startedAtMs + slice.toMinutes * 60_000);

      // ---- Main meetings ------------------------------------------------
      const { data: meetingRows, error } = await admin
        .from("meetings")
        .select(
          "id, user_id, client_id, topic, scheduled_at, duration_minutes, timezone, meet_link",
        )
        .eq("status", "confirmed")
        .gte("scheduled_at", from.toISOString())
        .lt("scheduled_at", to.toISOString())
        .limit(500);

      if (error) throw new Error(error.message);

      for (const row of (meetingRows ?? []) as Array<{
        id: string;
        user_id: string;
        client_id: string | null;
        topic: string;
        scheduled_at: string;
        duration_minutes: number;
        timezone: string;
        meet_link: string | null;
      }>) {
        const client = await lookupClient(admin, row.client_id);
        if (!client?.email) {
          skipped += 1;
          continue;
        }
        const owner = await lookupOwner(admin, row.user_id, ownerCache);

        const rendered = renderMeetingReminderEmail({
          topic: row.topic,
          whenFormatted: formatWhen(row.scheduled_at, row.timezone),
          window: slice.window,
          durationMinutes: row.duration_minutes,
          clientName: client.name ?? undefined,
          hostName: owner.name,
          meetLink: row.meet_link,
          brand: owner.brand,
        });

        const dispatch = await dispatchDelivery({
          userId: row.user_id,
          kind: "meeting_reminder",
          entityType: "meeting",
          senderType: "share",
          entityId: row.id,
          to: { email: client.email, name: client.name ?? undefined },
          ...(owner.email
            ? { replyTo: { email: owner.email, name: owner.name } }
            : {}),
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          metadata: { meetingId: row.id, window: slice.window },
          tags: ["meeting_reminder", slice.window],
          idempotencyKey: `meeting-reminder:${row.id}:${slice.window}`,
        });

        if (dispatch.ok) sent += 1;
        else {
          failed += 1;
          log.warn("cron.meeting_reminders.failed", {
            meetingId: row.id,
            window: slice.window,
            error: dispatch.error,
          });
        }
      }

      // ---- Portal meeting requests --------------------------------------
      const { data: portalRows, error: portalError } = await admin
        .from("portal_meetings")
        .select(
          "id, portal_id, requested_by, topic, scheduled_at, duration_minutes, timezone, meet_link",
        )
        .eq("status", "accepted")
        .gte("scheduled_at", from.toISOString())
        .lt("scheduled_at", to.toISOString())
        .limit(500);

      if (portalError) throw new Error(portalError.message);

      for (const row of (portalRows ?? []) as Array<{
        id: string;
        portal_id: string;
        requested_by: string;
        topic: string;
        scheduled_at: string;
        duration_minutes: number;
        timezone: string;
        meet_link: string | null;
      }>) {
        const { data: portal } = await admin
          .from("portals")
          .select("user_id")
          .eq("id", row.portal_id)
          .maybeSingle();
        const ownerId = (portal as { user_id: string } | null)?.user_id;
        if (!ownerId) {
          skipped += 1;
          continue;
        }

        // The requester is a portal member, so their address lives on their
        // profile rather than on the membership row.
        const { data: requester } = await admin
          .from("user_profiles")
          .select("email, full_name")
          .eq("id", row.requested_by)
          .maybeSingle();
        const r = requester as
          | { email: string | null; full_name: string | null }
          | null;

        // Don't remind the freelancer about their own request — Google
        // Calendar already does that, and it reads as a bug.
        if (!r?.email || row.requested_by === ownerId) {
          skipped += 1;
          continue;
        }

        const owner = await lookupOwner(admin, ownerId, ownerCache);
        const rendered = renderMeetingReminderEmail({
          topic: row.topic,
          whenFormatted: formatWhen(row.scheduled_at, row.timezone),
          window: slice.window,
          durationMinutes: row.duration_minutes,
          clientName: r.full_name ?? undefined,
          hostName: owner.name,
          meetLink: row.meet_link,
          brand: owner.brand,
        });

        const dispatch = await dispatchDelivery({
          userId: ownerId,
          kind: "meeting_reminder",
          entityType: "meeting",
          senderType: "share",
          entityId: row.id,
          to: { email: r.email, name: r.full_name ?? undefined },
          ...(owner.email
            ? { replyTo: { email: owner.email, name: owner.name } }
            : {}),
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          metadata: { portalMeetingId: row.id, window: slice.window },
          tags: ["meeting_reminder", "portal", slice.window],
          idempotencyKey: `portal-meeting-reminder:${row.id}:${slice.window}`,
        });

        if (dispatch.ok) sent += 1;
        else {
          failed += 1;
          log.warn("cron.meeting_reminders.portal_failed", {
            portalMeetingId: row.id,
            window: slice.window,
            error: dispatch.error,
          });
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    log.error("cron.meeting_reminders.query_failed", { error: message });
    await recordCronRun({
      job: "meeting-reminders",
      status: "error",
      startedAtMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  log.info("cron.meeting_reminders.summary", { sent, failed, skipped });
  await recordCronRun({
    job: "meeting-reminders",
    status: "ok",
    startedAtMs,
    detail: { sent, failed, skipped },
  });

  return NextResponse.json({
    ok: true,
    sent,
    failed,
    skipped,
    time: new Date().toISOString(),
  });
}

/** Format a start time in the meeting's own timezone, not the server's. */
function formatWhen(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: timezone || "Asia/Kolkata",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

async function lookupClient(
  admin: ReturnType<typeof getAdminSupabase>,
  clientId: string | null,
): Promise<{ email: string | null; name: string | null } | null> {
  if (!clientId) return null;
  const { data } = await admin
    .from("clients")
    .select("email, full_name, business_name")
    .eq("id", clientId)
    .maybeSingle();
  const row = data as
    | { email: string | null; full_name: string | null; business_name: string | null }
    | null;
  if (!row) return null;
  return { email: row.email, name: row.business_name || row.full_name };
}

/** Owner identity + branding, cached so one busy hour isn't N profile reads. */
async function lookupOwner(
  admin: ReturnType<typeof getAdminSupabase>,
  userId: string,
  cache: Map<string, OwnerContact>,
): Promise<OwnerContact> {
  const hit = cache.get(userId);
  if (hit) return hit;

  const { data } = await admin
    .from("user_profiles")
    .select(
      "email, business_name, full_name, brand_color, logo_url, business_email, business_phone, website",
    )
    .eq("id", userId)
    .maybeSingle();
  const p = data as
    | {
        email: string | null;
        business_name: string | null;
        full_name: string | null;
        brand_color: string | null;
        logo_url: string | null;
        business_email: string | null;
        business_phone: string | null;
        website: string | null;
      }
    | null;

  const contact: OwnerContact = {
    name: p?.business_name || p?.full_name || "Your freelancer",
    email: p?.email ?? null,
    brand: buildEmailBrand({
      businessName: p?.business_name ?? null,
      fullName: p?.full_name ?? null,
      brandColor: p?.brand_color ?? null,
      logoUrl: await resolveEmailLogoUrl(p?.logo_url, admin),
      businessEmail: p?.business_email ?? null,
      email: p?.email ?? null,
      businessPhone: p?.business_phone ?? null,
      website: p?.website ?? null,
    }),
  };
  cache.set(userId, contact);
  return contact;
}
