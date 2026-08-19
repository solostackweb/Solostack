import "server-only";

import crypto from "node:crypto";

/**
 * Thin Google Calendar client — OAuth + free/busy + event creation. Free API.
 * Everything is gated behind GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET /
 * GOOGLE_OAUTH_REDIRECT; without them isGoogleConfigured() is false and callers
 * fall back to the manual propose-slots flow.
 */

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_FREEBUSY = "https://www.googleapis.com/calendar/v3/freeBusy";
const GOOGLE_EVENTS =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * Sending mail on the user's behalf. Requested up front with the calendar
 * scopes so one consent screen unlocks everything, but nothing sends through
 * Gmail until the user explicitly opts in — see `send_as_gmail`.
 */
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
  GMAIL_SEND_SCOPE,
  "openid",
  "email",
];

/**
 * True when a stored grant actually carries the Gmail send scope. Connections
 * made before that scope was requested won't have it, so this is what tells
 * the UI to ask for a reconnect instead of silently doing nothing.
 */
export function grantIncludesGmailSend(scope: string | null | undefined): boolean {
  return Boolean(scope && scope.split(/\s+/).includes(GMAIL_SEND_SCOPE));
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REDIRECT,
  );
}

export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT ?? "",
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPES.join(" "),
    state,
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string;
  email: string | null;
}

function parseEmailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload, "base64").toString("utf8"),
    ) as { email?: string };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<GoogleTokens | null> {
  if (!isGoogleConfigured()) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT ?? "",
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      id_token?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresIn: data.expires_in,
      scope: data.scope,
      email: parseEmailFromIdToken(data.id_token),
    };
  } catch {
    return null;
  }
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number } | null> {
  if (!isGoogleConfigured()) return null;
  try {
    const res = await fetch(GOOGLE_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch {
    return null;
  }
}

export async function getBusyBlocks(
  accessToken: string,
  fromIso: string,
  toIso: string,
): Promise<Array<{ start: string; end: string }>> {
  try {
    const res = await fetch(GOOGLE_FREEBUSY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin: fromIso,
        timeMax: toIso,
        items: [{ id: "primary" }],
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      calendars?: { primary?: { busy?: Array<{ start: string; end: string }> } };
    };
    return data.calendars?.primary?.busy ?? [];
  } catch {
    return [];
  }
}

export async function createCalendarEvent(
  accessToken: string,
  input: {
    summary: string;
    description?: string;
    startIso: string;
    endIso: string;
    attendeeEmail?: string | null;
    timezone: string;
    withMeet?: boolean;
  },
): Promise<{
  eventId: string | null;
  htmlLink: string | null;
  meetLink: string | null;
} | null> {
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startIso, timeZone: input.timezone },
    end: { dateTime: input.endIso, timeZone: input.timezone },
  };
  if (input.attendeeEmail) {
    body.attendees = [{ email: input.attendeeEmail }];
  }
  if (input.withMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  try {
    const res = await fetch(
      `${GOOGLE_EVENTS}?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: Array<{ uri?: string }> };
    };
    const meetLink =
      data.hangoutLink ??
      data.conferenceData?.entryPoints?.find((entry) =>
        entry.uri?.includes("meet.google.com"),
      )?.uri ??
      null;
    return {
      eventId: data.id ?? null,
      htmlLink: data.htmlLink ?? null,
      meetLink,
    };
  } catch {
    return null;
  }
}

/**
 * Remove an event from the freelancer's calendar, cancelling the invite for
 * any attendee too.
 *
 * Treats 404/410 as success: the event is already gone, which is the state the
 * caller wanted. Returns false only when the deletion genuinely failed, so a
 * caller can decide whether that's worth surfacing.
 */
export async function deleteCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return true;
  try {
    const res = await fetch(
      `${GOOGLE_EVENTS}/${encodeURIComponent(eventId)}?sendUpdates=all`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return res.ok || res.status === 404 || res.status === 410;
  } catch {
    return false;
  }
}
