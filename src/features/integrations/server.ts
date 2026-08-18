import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import {
  getCalendarConnection,
  isGoogleConfigured,
} from "@/features/scheduling/server";
import { isDailyConfigured } from "@/features/meetings/video";
import { isZoomConfigured } from "@/features/meetings/zoom";
import {
  getGmailSendAsState,
  type GmailSendAsState,
} from "@/features/email/gmail-sender";

/**
 * Real connection state for every provider Stackivo talks to.
 *
 * This is the single source of truth behind the Integrations hub and the
 * calendar badge on the Meetings page. Nothing here is hardcoded — every
 * field is either a deployment-level env check or a row in
 * `calendar_connections`, so a card can never claim a connection that
 * doesn't exist.
 */

export { isZoomConfigured };

/** True when OAuth tokens can actually be encrypted (and therefore stored). */
export function isTokenEncryptionConfigured(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY);
}

export interface GoogleIntegrationState {
  /** Deployment has GOOGLE_CLIENT_ID / SECRET / OAUTH_REDIRECT. */
  configured: boolean;
  /** Deployment can encrypt tokens — without this a connect silently fails. */
  tokenStorageReady: boolean;
  /** This user has a stored refresh token. */
  connected: boolean;
  email: string | null;
}

export interface IntegrationsState {
  google: GoogleIntegrationState;
  gmail: GmailSendAsState;
  daily: { configured: boolean };
  zoom: { configured: boolean };
}

const GMAIL_OFF: GmailSendAsState = {
  connected: false,
  scopeGranted: false,
  enabled: false,
  email: null,
};

const DISCONNECTED: GoogleIntegrationState = {
  configured: false,
  tokenStorageReady: false,
  connected: false,
  email: null,
};

/** Google connection state for the signed-in freelancer. */
export async function getGoogleIntegrationState(): Promise<GoogleIntegrationState> {
  const configured = isGoogleConfigured();
  const tokenStorageReady = isTokenEncryptionConfigured();

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ...DISCONNECTED, configured, tokenStorageReady };

  const connection = await getCalendarConnection(user.id);
  return {
    configured,
    tokenStorageReady,
    connected: connection.connected,
    email: connection.email,
  };
}

/** Everything the Integrations hub needs, in one call. */
export async function getIntegrationsState(): Promise<IntegrationsState> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [google, gmail] = await Promise.all([
    getGoogleIntegrationState(),
    user ? getGmailSendAsState(user.id) : Promise.resolve(GMAIL_OFF),
  ]);

  return {
    google,
    gmail,
    daily: { configured: isDailyConfigured() },
    zoom: { configured: isZoomConfigured() },
  };
}
