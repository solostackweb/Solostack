/**
 * GET /api/google/callback — OAuth redirect target. Verifies CSRF state,
 * exchanges the code for tokens, stores them encrypted, and returns the
 * freelancer to whichever page started the flow.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/features/scheduling/google";
import { encryptToken } from "@/features/scheduling/crypto";
import {
  DEFAULT_GOOGLE_RETURN,
  GOOGLE_RETURN_COOKIE,
  safeReturnPath,
} from "@/features/scheduling/oauth-return";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;

  const cookieStore = await cookies();
  const returnPath = safeReturnPath(
    cookieStore.get(GOOGLE_RETURN_COOKIE)?.value ?? DEFAULT_GOOGLE_RETURN,
  );

  const clearCookies = () => {
    cookieStore.delete("g_oauth_state");
    cookieStore.delete(GOOGLE_RETURN_COOKIE);
  };

  const back = (query: Record<string, string>) => {
    const target = new URL(returnPath, origin);
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value);
    }
    return target;
  };

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    clearCookies();
    return NextResponse.redirect(back({ error: "missing" }));
  }

  const savedState = cookieStore.get("g_oauth_state")?.value;
  if (!savedState || savedState !== state) {
    clearCookies();
    return NextResponse.redirect(back({ error: "state" }));
  }

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    clearCookies();
    return NextResponse.redirect(new URL("/login", origin));
  }

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens || !tokens.refreshToken) {
    clearCookies();
    return NextResponse.redirect(back({ error: "exchange" }));
  }

  const encryptedRefresh = encryptToken(tokens.refreshToken);
  // encryptToken returns null when TOKEN_ENCRYPTION_KEY is unset. Storing that
  // would leave a row that reads as "not connected" on every later check, so
  // treat it as a hard failure rather than a silent no-op.
  if (!encryptedRefresh) {
    clearCookies();
    return NextResponse.redirect(back({ error: "storage" }));
  }

  const { error } = await supabase.from("calendar_connections").upsert(
    {
      user_id: user.id,
      provider: "google",
      google_email: tokens.email,
      access_token: encryptToken(tokens.accessToken),
      refresh_token: encryptedRefresh,
      token_expiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "user_id" },
  );

  clearCookies();

  if (error) {
    return NextResponse.redirect(back({ error: "save" }));
  }
  return NextResponse.redirect(back({ connected: "1" }));
}
