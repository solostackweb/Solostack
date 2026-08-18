import "server-only";

/**
 * Zoom integration for generated meeting links. Optional: everything is gated
 * behind ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET, so without
 * them isZoomConfigured() is false and Zoom never appears as a choice.
 *
 * Uses a Server-to-Server OAuth app: Stackivo's own Zoom account creates the
 * meeting, so freelancers don't each authorise a Zoom app. Mirrors the shape
 * of video.ts — every failure returns null and is treated as "no link", never
 * as a hard error that blocks a booking.
 */

const ZOOM_OAUTH = "https://zoom.us/oauth/token";
const ZOOM_API = "https://api.zoom.us/v2";

export function isZoomConfigured(): boolean {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID &&
      process.env.ZOOM_CLIENT_ID &&
      process.env.ZOOM_CLIENT_SECRET,
  );
}

/** True when a stored link is a Zoom join URL (vs. some other provider). */
export function isZoomMeetingUrl(url: string | null | undefined): boolean {
  return Boolean(url && /(^|\.)zoom\.us\//i.test(url));
}

// Account-credentials tokens last an hour. Cache in module memory and refresh
// a minute early rather than paying an extra round trip on every booking.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getZoomAccessToken(): Promise<string | null> {
  if (!isZoomConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  try {
    const res = await fetch(ZOOM_OAUTH, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "account_credentials",
        account_id: process.env.ZOOM_ACCOUNT_ID ?? "",
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      cachedToken = null;
      return null;
    }
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.token;
  } catch {
    cachedToken = null;
    return null;
  }
}

export interface ZoomMeeting {
  /** The URL the client opens. */
  joinUrl: string;
  /** Host-only URL — never send this to a client. */
  startUrl: string | null;
  meetingId: string | null;
  passcode: string | null;
}

/**
 * Create a scheduled Zoom meeting. Returns null when Zoom isn't configured or
 * the API call fails — callers fall back to "no video link", exactly like
 * createDailyRoom().
 */
export async function createZoomMeeting(opts: {
  topic: string;
  startIso: string;
  durationMinutes: number;
  timezone: string;
  agenda?: string | null;
}): Promise<ZoomMeeting | null> {
  const token = await getZoomAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${ZOOM_API}/users/me/meetings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: opts.topic.slice(0, 200),
        // 2 = a scheduled meeting at a fixed time.
        type: 2,
        start_time: opts.startIso,
        duration: opts.durationMinutes,
        timezone: opts.timezone,
        agenda: opts.agenda ? opts.agenda.slice(0, 2000) : undefined,
        settings: {
          join_before_host: true,
          waiting_room: false,
          // 2 = no registration required; the join link is the ticket.
          approval_type: 2,
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      join_url?: string;
      start_url?: string;
      id?: number | string;
      password?: string;
    };
    if (!data.join_url) return null;
    return {
      joinUrl: data.join_url,
      startUrl: data.start_url ?? null,
      meetingId: data.id != null ? String(data.id) : null,
      passcode: data.password ?? null,
    };
  } catch {
    return null;
  }
}
