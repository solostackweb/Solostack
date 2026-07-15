/**
 * GET /api/google/connect — start the Google Calendar OAuth flow.
 * Requires a signed-in freelancer. Sets a CSRF state cookie, then redirects to
 * Google's consent screen. No-op-safe when Google isn't configured.
 */

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";
import {
  buildGoogleAuthUrl,
  isGoogleConfigured,
} from "@/features/scheduling/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const settings = new URL("/dashboard/meetings/availability", origin);

  if (!isGoogleConfigured()) {
    settings.searchParams.set("error", "not_configured");
    return NextResponse.redirect(settings);
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
  cookieStore.set("g_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
