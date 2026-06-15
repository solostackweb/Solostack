/**
 * Single-meeting calendar download.
 *
 *   GET /api/portals/<portalId>/meetings/<meetingId>/calendar.ics
 *
 * Browser-triggered (the logged-in member clicks "Add to calendar"), so it
 * authenticates via the normal portal access check (cookies are sent).
 */

import { NextResponse } from "next/server";
import {
  PortalAccessError,
  requirePortalAccess,
} from "@/features/portals/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { buildICS, type CalendarEvent } from "@/features/portals/calendar";
import { env } from "@/config/env";
import { portalClientHome } from "@/features/portals/routes";
import type { PortalMeetingRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portalId: string; meetingId: string }> },
): Promise<Response> {
  const { portalId, meetingId } = await params;

  const access = await requirePortalAccess(portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminSupabase();
  const { data } = await admin
    .from("portal_meetings")
    .select("*")
    .eq("id", meetingId)
    .eq("portal_id", portalId)
    .maybeSingle();
  const meeting = data as PortalMeetingRow | null;

  if (!meeting || !meeting.scheduled_at) {
    return NextResponse.json(
      { error: "No scheduled time for this meeting yet." },
      { status: 404 },
    );
  }

  const portalUrl = `${env.appUrl}${portalClientHome(portalId)}`;
  const event: CalendarEvent = {
    uid: meeting.id,
    title: meeting.topic,
    startIso: meeting.scheduled_at,
    durationMinutes: meeting.duration_minutes ?? 30,
    description: meeting.notes,
    url: meeting.meet_link ?? portalUrl,
    location: meeting.meet_link ?? portalUrl,
  };

  const ics = buildICS([event], { calendarName: meeting.topic });
  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="meeting-${meetingId}.ics"`,
      "cache-control": "no-store",
    },
  });
}
