import "server-only";

/**
 * Daily.co integration for in-app video. Optional: everything is gated behind
 * DAILY_API_KEY, so without a key the app falls back to a pasted Meet/Zoom
 * link. Daily's free tier (10k participant-minutes/month) covers a freelancer's
 * 1:1 calls at no cost. We embed the Prebuilt room via an iframe, so no client
 * SDK dependency is required.
 */

const DAILY_API = "https://api.daily.co/v1";

export function isDailyConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY);
}

/** True when a stored link is a Daily room we can embed (vs. an external link). */
export function isDailyRoomUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\.daily\.co\//i.test(url));
}

/**
 * Create a Daily room that expires a few hours after the scheduled time (or a
 * week out if unscheduled). Returns null if not configured or on any failure —
 * callers treat that as "video unavailable", never as a hard error.
 */
export async function createDailyRoom(opts: {
  expiresAt?: string | null;
}): Promise<{ url: string } | null> {
  const key = process.env.DAILY_API_KEY;
  if (!key) return null;

  const base = Math.floor(Date.now() / 1000);
  let exp = base + 7 * 24 * 60 * 60;
  if (opts.expiresAt) {
    const scheduled = new Date(opts.expiresAt).getTime();
    if (!Number.isNaN(scheduled)) {
      exp = Math.floor(scheduled / 1000) + 4 * 60 * 60;
    }
  }

  try {
    const res = await fetch(`${DAILY_API}/rooms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        privacy: "public",
        properties: {
          exp,
          enable_prejoin_ui: true,
          enable_chat: true,
          enable_screenshare: true,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ? { url: data.url } : null;
  } catch {
    return null;
  }
}
