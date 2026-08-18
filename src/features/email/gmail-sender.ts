import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { CalendarConnectionRow } from "@/lib/supabase/types";
import { grantIncludesGmailSend } from "@/features/scheduling/google";
import { accessTokenForBooking } from "@/features/scheduling/server";

/**
 * Decides whether a given user's mail should go out through their own Gmail.
 *
 * Three independent conditions all have to hold, and any one of them failing
 * silently returns null so the caller falls through to Brevo:
 *   1. the user switched send-as on,
 *   2. the stored OAuth grant actually includes the gmail.send scope
 *      (connections made before that scope was requested do not), and
 *   3. a valid access token can be produced right now.
 */

export interface GmailSenderIdentity {
  email: string;
  accessToken: string;
}

export interface GmailSendAsState {
  /** Row exists and holds a refresh token. */
  connected: boolean;
  /** The grant carries gmail.send — false means "needs a reconnect". */
  scopeGranted: boolean;
  /** The user's switch. */
  enabled: boolean;
  email: string | null;
}

const OFF: GmailSendAsState = {
  connected: false,
  scopeGranted: false,
  enabled: false,
  email: null,
};

/** UI-facing state for the Integrations hub. Never touches the token. */
export async function getGmailSendAsState(
  userId: string,
): Promise<GmailSendAsState> {
  if (!userId) return OFF;
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("calendar_connections")
    .select("google_email, refresh_token, scope, send_as_gmail")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as Pick<
    CalendarConnectionRow,
    "google_email" | "refresh_token" | "scope" | "send_as_gmail"
  > | null;
  if (!row?.refresh_token) return OFF;

  return {
    connected: true,
    scopeGranted: grantIncludesGmailSend(row.scope),
    enabled: Boolean(row.send_as_gmail),
    email: row.google_email,
  };
}

/**
 * The address and token to send as, or null when Brevo should handle it.
 * Called on the hot path of every client-facing document send.
 */
export async function getGmailSenderIdentity(
  userId: string | null | undefined,
): Promise<GmailSenderIdentity | null> {
  if (!userId) return null;

  const state = await getGmailSendAsState(userId);
  if (!state.enabled || !state.scopeGranted || !state.email) return null;

  const accessToken = await accessTokenForBooking(userId);
  if (!accessToken) return null;

  return { email: state.email, accessToken };
}
