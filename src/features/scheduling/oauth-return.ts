/**
 * Where a user lands after the Google OAuth round trip.
 *
 * The connect route records the page the flow started from in a short-lived
 * cookie and the callback reads it back, so connecting from the Integrations
 * hub returns to the Integrations hub instead of always dumping the user on
 * the availability page.
 */

export const DEFAULT_GOOGLE_RETURN = "/dashboard/meetings/availability";

/** Cookie holding the return path for the in-flight OAuth attempt. */
export const GOOGLE_RETURN_COOKIE = "g_oauth_next";

/**
 * Only same-origin dashboard paths survive the round trip — an
 * attacker-supplied `next` must never become an open redirect.
 */
export function safeReturnPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_GOOGLE_RETURN;
  if (!raw.startsWith("/dashboard")) return DEFAULT_GOOGLE_RETURN;
  if (raw.startsWith("//") || raw.includes("\\") || raw.includes(":")) {
    return DEFAULT_GOOGLE_RETURN;
  }
  return raw;
}
