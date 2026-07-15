/**
 * GET /api/google/callback — OAuth redirect target. Verifies CSRF state,
 * exchanges the code for tokens, stores them encrypted, and returns the
 * freelancer to the availability settings page.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/features/scheduling/google";
import { encryptToken } from "@/features/scheduling/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const settings = (query: Record<string, string>) => {
    const target = new URL("/dashboard/meetings/availability", origin);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value);
    }
    return target;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(settings({ error: "missing" }));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("g_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(settings({ error: "state" }));
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens || !tokens.refreshToken) {
    return NextResponse.redirect(settings({ error: "exchange" }));
  }

  const { error } = await supabase.from("calendar_connections").upsert(
    {
      user_id: user.id,
      provider: "google",
      google_email: tokens.email,
      access_token: encryptToken(tokens.accessToken),
      refresh_token: encryptToken(tokens.refreshToken),
      token_expiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );

  cookieStore.delete("g_oauth_state");

  if (error) {
    return NextResponse.redirect(settings({ error: "save" }));
  }
  return NextResponse.redirect(settings({ connected: "1" }));
}
