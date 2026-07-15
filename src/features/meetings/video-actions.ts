"use server";

import { revalidatePath } from "next/cache";

import { getServerSupabase } from "@/lib/supabase/server";
import { createDailyRoom, isDailyConfigured } from "./video";

export type VideoActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Owner turns on in-app video for a meeting. Creates a Daily room and stores
 * its URL in meet_link (the public confirm page then embeds it). No-op-safe
 * when Daily isn't configured.
 */
export async function enableMeetingVideoAction(input: {
  id: string;
}): Promise<VideoActionResult<{ url: string }>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  if (!isDailyConfigured()) {
    return {
      ok: false,
      error: "In-app video isn't set up yet. Paste a Meet/Zoom link instead.",
    };
  }

  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("meetings")
    .select("id, scheduled_at")
    .eq("id", input.id)
    .eq("user_id", userId)
    .maybeSingle();

  const meeting = data as { id: string; scheduled_at: string | null } | null;
  if (!meeting) return { ok: false, error: "Meeting not found." };

  const room = await createDailyRoom({ expiresAt: meeting.scheduled_at });
  if (!room) {
    return { ok: false, error: "Could not create the video room. Try again." };
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      meet_link: room.url,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", input.id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/meetings");
  revalidatePath(`/dashboard/meetings/${input.id}`);
  return { ok: true, data: { url: room.url }, message: "In-app video is ready." };
}
