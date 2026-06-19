/**
 * OAuth + email-confirmation callback.
 *
 * Supabase will redirect here after:
 *   1. A successful Google OAuth flow (with `?code=...`).
 *   2. The user clicking the email-verification link from signup
 *      (also `?code=...`).
 *
 * We exchange the one-time code for a session, which sets the auth cookies
 * via our server Supabase client, then redirect to the short-lived
 * `stackivo_oauth_next` cookie or `?next=` fallback (sanitised).
 *
 * Error handling:
 *   - Missing code     → redirect to login with ?error=missing_code
 *   - Exchange failure → redirect to login with ?error=<encoded message>
 *   - Both pages (login + signup) now render the ?error= param.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  AUTH_DEFAULT_REDIRECT,
  AUTH_LOGIN_ROUTE,
  isClientPortalPath,
} from "@/features/auth/routes";
import { activatePendingPortalInvitesForCurrentUser } from "@/features/portals/invitations";
import { portalClientHome } from "@/features/portals/routes";

function sanitiseNext(raw: string | null): string {
  if (!raw) return AUTH_DEFAULT_REDIRECT;
  if (!raw.startsWith("/") || raw.startsWith("//")) return AUTH_DEFAULT_REDIRECT;
  if (raw === "/reset-password") return raw;
  // Never redirect back to auth-only pages (would cause a loop).
  const authPaths = ["/login", "/signup", "/forgot-password", "/reset-password"];
  if (authPaths.some((p) => raw === p || raw.startsWith(`${p}?`))) {
    return AUTH_DEFAULT_REDIRECT;
  }
  return raw;
}

function sanitiseErrorRedirect(raw: string | null): typeof AUTH_LOGIN_ROUTE | "/signup" {
  return raw === "/signup" ? "/signup" : AUTH_LOGIN_ROUTE;
}

function redirectAndClearOauthCookies(url: string, next?: string): NextResponse {
  const response = NextResponse.redirect(url);
  response.cookies.delete("stackivo_oauth_next");
  response.cookies.delete("stackivo_oauth_from");
  response.cookies.delete("stackivo_signup_next");
  if (next && isClientPortalPath(next)) {
    response.cookies.set("stackivo_portal_return_to", next, {
      httpOnly: true,
      maxAge: 5 * 60,
      path: "/",
      sameSite: "lax",
      secure: url.startsWith("https://"),
    });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const cookieStore = await cookies();
  const next = sanitiseNext(
    cookieStore.get("stackivo_oauth_next")?.value ??
      cookieStore.get("stackivo_signup_next")?.value ??
      searchParams.get("next"),
  );
  const errorRedirect = sanitiseErrorRedirect(
    cookieStore.get("stackivo_oauth_from")?.value ?? AUTH_LOGIN_ROUTE,
  );

  if (searchParams.get("error")) {
    const errorCode = encodeURIComponent(
      searchParams.get("error_description") ??
        searchParams.get("error") ??
        "auth_callback_error",
    );
    return redirectAndClearOauthCookies(
      `${origin}${errorRedirect}?error=${errorCode}`,
    );
  }

  if (!code && (!tokenHash || !type)) {
    return redirectAndClearOauthCookies(
      `${origin}${errorRedirect}?error=missing_code`,
    );
  }

  const supabase = await getServerSupabase();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: type!,
      });

  if (error) {
    // Surface the raw error code so login/signup can show something helpful.
    const errorCode = encodeURIComponent(error.message);
    return redirectAndClearOauthCookies(
      `${origin}${errorRedirect}?error=${errorCode}`,
    );
  }

  // Session established — send the user to their destination.
  if (isClientPortalPath(next)) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      const activated = await activatePendingPortalInvitesForCurrentUser(
        user.email,
      );
      if (activated.ok && next === "/portal") {
        const portalIds = activated.data?.portalIds ?? [];
        if (portalIds.length === 1) {
          return redirectAndClearOauthCookies(
            `${origin}${portalClientHome(portalIds[0]!)}`,
            next,
          );
        }
      }
    }
  }

  return redirectAndClearOauthCookies(`${origin}${next}`, next);
}
