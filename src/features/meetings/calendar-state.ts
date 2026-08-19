import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import {
  getCalendarConnection,
  isGoogleConfigured,
} from "@/features/scheduling/server";

/**
 * Whether this user can schedule at all.
 *
 * Meetings run entirely on Google Calendar + Meet, so three things must hold
 * before the feature works: the deployment has OAuth credentials, it can
 * encrypt tokens (otherwise a "successful" connect stores nothing), and this
 * user has actually connected. Each failure needs different wording, so they
 * stay separate flags rather than one boolean.
 */
export interface MeetingsCalendarState {
  configured: boolean;
  tokenStorageReady: boolean;
  connected: boolean;
  email: string | null;
}

export async function getMeetingsCalendarState(): Promise<MeetingsCalendarState> {
  const configured = isGoogleConfigured();
  const tokenStorageReady = Boolean(process.env.TOKEN_ENCRYPTION_KEY);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { configured, tokenStorageReady, connected: false, email: null };
  }

  const connection = await getCalendarConnection(user.id);
  return {
    configured,
    tokenStorageReady,
    connected: connection.connected,
    email: connection.email,
  };
}
