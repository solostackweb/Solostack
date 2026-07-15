import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  CalendarConnectionRow,
  SchedulingSettingsRow,
} from "@/lib/supabase/types";
import { decryptToken, encryptToken } from "./crypto";
import {
  getBusyBlocks,
  isGoogleConfigured,
  refreshAccessToken,
} from "./google";

export { isGoogleConfigured };

export interface SchedulingSettings {
  timezone: string;
  workingHours: Record<string, Array<[string, string]>>;
  bufferMinutes: number;
  minNoticeHours: number;
  slotIntervalMinutes: number;
}

const DEFAULT_SETTINGS: SchedulingSettings = {
  timezone: "Asia/Kolkata",
  workingHours: {
    "1": [["09:00", "17:00"]],
    "2": [["09:00", "17:00"]],
    "3": [["09:00", "17:00"]],
    "4": [["09:00", "17:00"]],
    "5": [["09:00", "17:00"]],
  },
  bufferMinutes: 15,
  minNoticeHours: 12,
  slotIntervalMinutes: 30,
};

function normalizeWorkingHours(
  value: unknown,
): Record<string, Array<[string, string]>> {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS.workingHours;
  const out: Record<string, Array<[string, string]>> = {};
  for (const [key, ranges] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(ranges)) continue;
    const parsed: Array<[string, string]> = [];
    for (const range of ranges) {
      if (
        Array.isArray(range) &&
        typeof range[0] === "string" &&
        typeof range[1] === "string"
      ) {
        parsed.push([range[0], range[1]]);
      }
    }
    out[key] = parsed;
  }
  return out;
}

export async function getSchedulingSettings(
  userId: string,
): Promise<SchedulingSettings> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("scheduling_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as SchedulingSettingsRow | null;
  if (!row) return DEFAULT_SETTINGS;
  return {
    timezone: row.timezone,
    workingHours: normalizeWorkingHours(row.working_hours),
    bufferMinutes: row.buffer_minutes,
    minNoticeHours: row.min_notice_hours,
    slotIntervalMinutes: row.slot_interval_minutes,
  };
}

export async function getCalendarConnection(
  userId: string,
): Promise<{ connected: boolean; email: string | null }> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_connections")
    .select("google_email, refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as
    | { google_email: string | null; refresh_token: string | null }
    | null;
  return {
    connected: Boolean(row?.refresh_token),
    email: row?.google_email ?? null,
  };
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!isGoogleConfigured()) return null;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as CalendarConnectionRow | null;
  if (!row) return null;

  const expiry = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  const access = decryptToken(row.access_token);
  if (access && expiry - Date.now() > 60_000) return access;

  const refresh = decryptToken(row.refresh_token);
  if (!refresh) return null;
  const refreshed = await refreshAccessToken(refresh);
  if (!refreshed) return null;

  await admin
    .from("calendar_connections")
    .update({
      access_token: encryptToken(refreshed.accessToken),
      token_expiry: new Date(
        Date.now() + refreshed.expiresIn * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", userId);

  return refreshed.accessToken;
}

/** A valid access token for booking-time event creation (or null). */
export async function accessTokenForBooking(
  userId: string,
): Promise<string | null> {
  return getValidAccessToken(userId);
}

// ---------------------------------------------------------------------------
// Timezone helpers — convert wall-clock times in an IANA zone to UTC instants.
// ---------------------------------------------------------------------------

function partsInTz(
  date: Date,
  tz: string,
): { year: number; month: number; day: number; weekday: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

function zonedWallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = tzOffsetMs(tz, new Date(guess));
  return guess - offset;
}

/**
 * Open slots for the next `days` days: working-hours grid at the settings
 * interval, minus busy blocks (with buffer), respecting minimum notice.
 * Returns ISO start times. Empty when no calendar is connected.
 */
export async function computeOpenSlots(
  userId: string,
  opts: { durationMinutes: number; days?: number },
): Promise<string[]> {
  const token = await getValidAccessToken(userId);
  if (!token) return [];

  const settings = await getSchedulingSettings(userId);
  const days = opts.days ?? 14;
  const now = Date.now();
  const minStart = now + settings.minNoticeHours * 3_600_000;
  const busy = await getBusyBlocks(
    token,
    new Date(now).toISOString(),
    new Date(now + days * 86_400_000).toISOString(),
  );
  const busyRanges = busy.map(
    (block) =>
      [new Date(block.start).getTime(), new Date(block.end).getTime()] as [
        number,
        number,
      ],
  );

  const bufferMs = settings.bufferMinutes * 60_000;
  const durationMs = opts.durationMinutes * 60_000;
  const intervalMs = settings.slotIntervalMinutes * 60_000;
  const slots: string[] = [];

  for (let d = 0; d < days && slots.length < 40; d += 1) {
    const dayDate = new Date(now + d * 86_400_000);
    const p = partsInTz(dayDate, settings.timezone);
    const ranges = settings.workingHours[String(p.weekday)] ?? [];
    for (const [startHHMM, endHHMM] of ranges) {
      const [sh, sm] = startHHMM.split(":").map(Number);
      const [eh, em] = endHHMM.split(":").map(Number);
      const windowEnd = zonedWallTimeToInstant(
        p.year,
        p.month,
        p.day,
        eh,
        em,
        settings.timezone,
      );
      let cursor = zonedWallTimeToInstant(
        p.year,
        p.month,
        p.day,
        sh,
        sm,
        settings.timezone,
      );
      while (cursor + durationMs <= windowEnd && slots.length < 40) {
        const slotStart = cursor;
        const slotEnd = cursor + durationMs;
        if (slotStart >= minStart) {
          const overlaps = busyRanges.some(
            ([bs, be]) => slotStart < be + bufferMs && slotEnd + bufferMs > bs,
          );
          if (!overlaps) slots.push(new Date(slotStart).toISOString());
        }
        cursor += intervalMs;
      }
    }
  }

  return slots;
}
