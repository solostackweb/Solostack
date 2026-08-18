"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";

export type SchedulingActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const timeRange = z.tuple([
  z.string().regex(/^\d{2}:\d{2}$/),
  z.string().regex(/^\d{2}:\d{2}$/),
]);

const settingsSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  workingHours: z.record(z.string(), z.array(timeRange)),
  bufferMinutes: z.number().int().min(0).max(240),
  minNoticeHours: z.number().int().min(0).max(336),
  slotIntervalMinutes: z.number().int().min(10).max(240),
});

export async function saveSchedulingSettingsAction(
  input: z.infer<typeof settingsSchema>,
): Promise<SchedulingActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check your availability values." };
  }
  const d = parsed.data;

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("scheduling_settings")
    .upsert(
      {
        user_id: userId,
        timezone: d.timezone,
        working_hours: d.workingHours,
        buffer_minutes: d.bufferMinutes,
        min_notice_hours: d.minNoticeHours,
        slot_interval_minutes: d.slotIntervalMinutes,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id" },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/meetings/availability");
  return { ok: true, message: "Availability saved." };
}

export async function disconnectCalendarAction(): Promise<SchedulingActionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Please sign in." };

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/meetings/availability");
  revalidatePath("/dashboard/meetings");
  revalidatePath("/dashboard/settings/integrations");
  return { ok: true, message: "Calendar disconnected." };
}
