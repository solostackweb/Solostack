/**
 * Subscribable portal calendar feed (webcal).
 *
 *   GET /api/portals/<portalId>/calendar.ics?key=<token>
 *
 * Calendar apps poll this server-to-server WITHOUT browser cookies, so it
 * authenticates via the per-member `calendar_feed_token` carried in the URL
 * (created by getPortalCalendarFeedTokenAction). Returns all upcoming
 * confirmed meetings so they auto-sync into the subscriber's calendar.
 */

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildICS, type CalendarEvent } from "@/features/portals/calendar";
import { env } from "@/config/env";
import { portalClientHome } from "@/features/portals/routes";
import type { PortalMeetingRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ portalId: string }> },
): Promise<Response> {
  const { portalId } = await params;
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing key" }, { status: 401 });
  }

  const admin = getAdminSupabase();

  // Validate the token belongs to a member of this portal.
  const { data: member } = await admin
    .from("portal_members")
    .select("user_id, revoked_at")
    .eq("portal_id", portalId)
    .eq("calendar_feed_token", key)
    .is("revoked_at", null)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // Upcoming confirmed meetings only.
  const { data } = await admin
    .from("portal_meetings")
    .select("*")
    .eq("portal_id", portalId)
    .eq("status", "accepted")
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order("scheduled_at", { ascending: true });
  const meetings = (data ?? []) as PortalMeetingRow[];

  const portalUrl = `${env.appUrl}${portalClientHome(portalId)}`;
  const events: CalendarEvent[] = meetings
    .filter((m) => m.scheduled_at)
    .map((m) => ({
      uid: m.id,
      title: m.topic,
      startIso: m.scheduled_at as string,
      durationMinutes: m.duration_minutes ?? 30,
      description: m.notes,
      url: m.meet_link ?? portalUrl,
      location: m.meet_link ?? portalUrl,
    }));

  const ics = buildICS(events, { calendarName: "Stackivo — Meetings" });
  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
