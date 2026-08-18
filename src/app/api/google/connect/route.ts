/**
 * GET /api/google/connect — start the Google Calendar OAuth flow.
 *
 * Requires a signed-in freelancer. Sets a CSRF state cookie, remembers where
 * the user started from (`?next=`), then redirects to Google's consent screen.
 * No-op-safe when Google isn't configured.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";
import {
  buildGoogleAuthUrl,
  isGoogleConfigured,
} from "@/features/scheduling/google";
import {
  GOOGLE_RETURN_COOKIE,
  safeReturnPath,
} from "@/features/scheduling/oauth-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const returnPath = safeReturnPath(url.searchParams.get("next"));
  const back = (query: Record<string, string>) => {
    const target = new URL(returnPath, origin);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value);
    }
    return target;
  };

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(back({ error: "not_configured" }));
  }
  // Without an encryption key the callback cannot persist the refresh token,
  // so the connection would silently read as "not connected" forever. Fail
  // loudly here instead of sending the user through Google for nothing.
  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    return NextResponse.redirect(back({ error: "storage" }));
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set("g_oauth_state", state, cookieOptions);
  cookieStore.set(GOOGLE_RETURN_COOKIE, returnPath, cookieOptions);

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
