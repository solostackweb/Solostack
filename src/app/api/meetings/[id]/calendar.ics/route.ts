/**
 * Single-meeting calendar download (main meetings).
 *
 *   GET /api/meetings/<id>/calendar.ics
 *
 * Owner-only: the meeting must belong to the signed-in user.
 */

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildMeetingIcs } from "@/features/meetings/calendar";
import type { MeetingRow } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("meetings")
    .select("id, topic, notes, scheduled_at, duration_minutes, meet_link")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  const meeting = data as Pick<
    MeetingRow,
    | "id"
    | "topic"
    | "notes"
    | "scheduled_at"
    | "duration_minutes"
    | "meet_link"
  > | null;

  if (!meeting || !meeting.scheduled_at) {
    return NextResponse.json(
      { error: "No scheduled time for this meeting yet." },
      { status: 404 },
    );
  }

  const ics = buildMeetingIcs({
    uid: meeting.id,
    topic: meeting.topic,
    startIso: meeting.scheduled_at,
    durationMinutes: meeting.duration_minutes,
    description: meeting.meet_link
      ? `Join: ${meeting.meet_link}`
      : meeting.notes,
    location: meeting.meet_link,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="meeting-${id}.ics"`,
      "cache-control": "no-store",
    },
  });
}
