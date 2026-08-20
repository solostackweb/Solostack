"use server";

/**
 * Server actions for authentication.
 *
 * Keep these thin — they validate input, call Supabase, and return a
 * discriminated `ActionResult`. Redirects happen with `next/navigation`'s
 * `redirect()` so the browser's auth cookies (set by Supabase on the response)
 * are persisted.
 */

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { env } from "@/config/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  authLimit,
  getClientIp,
  passwordResetLimit,
  signupLimit,
} from "@/lib/rate-limit";
import { recordSecurityEvent } from "@/lib/security-events/server";
import { recordConsentIfNeeded } from "@/features/legal/consent";
import { hashedEmail } from "@/lib/logger/redact";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { log } from "@/lib/logger";
import { identifyServer, trackServerEvent } from "@/lib/analytics/server";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
  portalCodeRequestSchema,
  portalCodeVerifySchema,
  resetPasswordSchema,
} from "./schemas";
import {
  AUTH_DEFAULT_REDIRECT,
  AUTH_LOGIN_ROUTE,
  isClientPortalPath,
} from "./routes";
import {
  activatePortalAccessForUser,
  getPortalEmailAccessContext,
} from "@/features/portals/invitations";
import { portalClientHome } from "@/features/portals/routes";
import { dispatchDelivery } from "@/features/email/send";
import { renderPortalAccessCodeEmail } from "@/features/email/templates";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// --- helpers ----------------------------------------------------------------

/**
 * Map raw Supabase / GoTrue error messages to user-safe strings.
 *
 * GoTrue's internal messages (e.g. "Database error saving new user",
 * "unexpected_failure") are confusing to end users and may change between
 * GoTrue releases.  We normalise them here so the UI always shows something
 * actionable.
 */
function normalizeAuthError(message: string): string {
  const m = message.toLowerCase();
  // Database / trigger failure — the most common root cause on signup.
  if (
    m.includes("database error") ||
    m.includes("unexpected_failure") ||
    m.includes("unexpected failure") ||
    m.includes("saving new user")
  ) {
    return "We couldn't create your account right now. Please wait a moment and try again. If the problem persists, contact support.";
  }
  // Supabase email-send rate limits (built-in SMTP: 3/hr).
  if (
    m.includes("email rate limit") ||
    m.includes("only request this") ||
    m.includes("rate limit exceeded")
  ) {
    return "Too many requests. Please wait 60 seconds and try again.";
  }
  // Signups globally disabled on the project.
  if (m.includes("signups not allowed") || m.includes("signup disabled")) {
    return "Account registration is currently unavailable. Please try again later.";
  }
  // Invalid email format from Supabase validation.
  if (m.includes("unable to validate email") || m.includes("invalid email")) {
    return "Please enter a valid email address.";
  }
  // Password too short / weak.
  if (m.includes("password") && (m.includes("short") || m.includes("weak") || m.includes("length"))) {
    return "Password must be at least 8 characters.";
  }
  // Fallback — return the raw message as-is.
  return message;
}

function getAuthErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function getAuthErrorName(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const name = (err as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

function isAuthServiceUnavailable(err: unknown): boolean {
  const status = getAuthErrorStatus(err);
  if (status === 0 || (status !== undefined && status >= 500)) return true;

  const name = getAuthErrorName(err)?.toLowerCase() ?? "";
  if (name.includes("retryablefetch") || name.includes("fetcherror")) return true;

  const message =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === "string"
        ? err.toLowerCase()
        : "";
  return (
    message.includes("fetch failed") ||
    message.includes("network request failed") ||
    message.includes("failed to fetch")
  );
}

async function getOrigin(): Promise<string> {
  // SECURITY: this origin is embedded in password-reset + email-verification
  // links, so it must never be derived from an attacker-controlled Host
  // header (Host-header injection -> link poisoning). We trust the runtime
  // host ONLY when it matches the configured production origin or a Vercel
  // preview deploy; otherwise we fall back to the trusted configured origin.
  // (Supabase's Redirect-URL allowlist is a second line of defence.)
  const configured = env.appUrl;
  try {
    const h = await headers();
    const rawHost = h.get("x-forwarded-host") ?? h.get("host");
    const host = rawHost?.split(",")[0].trim();
    if (host) {
      const configuredHost = new URL(configured).host;
      const trusted = host === configuredHost || host.endsWith(".vercel.app");
      if (trusted) {
        const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
        return `${proto}://${host}`;
      }
    }
  } catch {
    // headers() unavailable - fall through to the trusted configured origin.
  }
  return configured;
}

function sanitiseNext(next: string | null | undefined): string {
  // Only allow local paths so `?next=https://evil.com` can't be abused.
  if (!next || typeof next !== "string") return AUTH_DEFAULT_REDIRECT;
  if (!next.startsWith("/") || next.startsWith("//")) return AUTH_DEFAULT_REDIRECT;
  return next;
}

async function safeHashedEmail(email: string): Promise<string | undefined> {
  try {
    return await hashedEmail(email);
  } catch {
    return undefined;
  }
}

function userSafeErrorMessage(err: unknown): string {
  const fallback = "We couldn't create your account. Please try again in a moment.";
  const status = getAuthErrorStatus(err);
  const name = getAuthErrorName(err)?.toLowerCase() ?? "";
  if (status === 504 || name.includes("retryablefetch")) {
    return "Signup is taking longer than expected. Please check your inbox first; if no verification email arrives in a minute, try again.";
  }
  if (err instanceof Error) {
    const message = err.message.trim();
    if (message && message !== "{}" && message !== "[]") return normalizeAuthError(message);
  }
  if (typeof err === "string") {
    const message = err.trim();
    if (message && message !== "{}" && message !== "[]") return normalizeAuthError(message);
  }
  if (err && typeof err === "object") {
    const maybeMessage = (err as { message?: unknown; error?: unknown }).message;
    if (typeof maybeMessage === "string") {
      const message = maybeMessage.trim();
      if (message && message !== "{}" && message !== "[]") return normalizeAuthError(message);
    }
    const maybeError = (err as { error?: unknown }).error;
    if (typeof maybeError === "string") {
      const message = maybeError.trim();
      if (message && message !== "{}" && message !== "[]") return normalizeAuthError(message);
    }
  }
  return fallback;
}

function isExistingAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  );
}

// --- signup -----------------------------------------------------------------

export async function signupAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { fullName, email, password } = parsed.data;
  try {
    // Per-IP rate-limit so a single network can't spam-create accounts.
    const ip = await getClientIp();
    const gate = await signupLimit(`signup:${ip}`);
    if (!gate.ok) {
      await recordSecurityEvent({
        kind: "auth_ratelimit_tripped",
        severity: "warn",
        metadata: { flow: "signup", ip },
      });
      return { ok: false, error: gate.message };
    }

    const challenge = await verifyTurnstileToken(
      formData.get("cf-turnstile-response")?.toString(),
      ip,
    );
    if (!challenge.ok) {
      await recordSecurityEvent({
        kind: "auth_signup_failed",
        severity: "warn",
        metadata: {
          email_hash: await safeHashedEmail(email),
          reason: "turnstile_failed",
        },
      });
      return { ok: false, error: challenge.error };
    }

    const supabase = await getServerSupabase();
    const origin = await getOrigin();
    const next = sanitiseNext(formData.get("next")?.toString() ?? null);
    const cookieStore = await cookies();

    cookieStore.set("stackivo_signup_next", next, {
      httpOnly: true,
      maxAge: 15 * 60,
      path: "/",
      sameSite: "lax",
      secure: origin.startsWith("https://"),
    });

    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      const message = userSafeErrorMessage(error);
      log.warn("auth.signup.supabase_failed", {
        error_code: (error as { code?: unknown }).code,
        error_status: (error as { status?: unknown }).status,
        error_name: error.name,
        error_message: error.message,
        user_message: message,
        email_redirect_to: `${origin}/auth/callback`,
        origin,
        email_hash: await safeHashedEmail(email),
      });
      await recordSecurityEvent({
        kind: "auth_signup_failed",
        severity: "info",
        metadata: {
          email_hash: await safeHashedEmail(email),
          reason: message,
        },
      });

      if (isExistingAccountError(message)) {
        return {
          ok: false,
          error:
            "An account with that email already exists. Try logging in instead, or reset your password.",
        };
      }

      return { ok: false, error: message };
    }

    // Supabase default behaviour for an already-registered email: returns a
    // placeholder user row with `identities: []` and NO error. Without this
    // check the UI would falsely confirm signup. We surface a generic
    // "already registered" message that nudges the user to the login page
    // without leaking which email exists.
    const identities = (signUpData.user?.identities ?? []) as unknown[];
    const looksLikeExistingAccount =
      !!signUpData.user && identities.length === 0;
    if (looksLikeExistingAccount) {
      await recordSecurityEvent({
        kind: "auth_signup_duplicate",
        severity: "info",
        metadata: { email_hash: await safeHashedEmail(email) },
      });
      return {
        ok: false,
        error:
          "An account with that email already exists. Try logging in instead, or reset your password.",
      };
    }

    // Identify the (unverified) user in PostHog so the funnel from
    // signup → email verified → onboarding completed is joinable.
    if (signUpData.user) {
      await identifyServer(signUpData.user.id, {
        email: signUpData.user.email,
        createdAt: signUpData.user.created_at,
      });
      await trackServerEvent(signUpData.user.id, "auth.user.signed_up");
      // DPDP Act: record provable, versioned consent for the checkbox the
      // user just ticked (validated above). Idempotent + never throws.
      await recordConsentIfNeeded(signUpData.user.id, "checkbox");
      await recordSecurityEvent({
        kind: "consent_recorded",
        severity: "info",
        userId: signUpData.user.id,
        metadata: { method: "checkbox", flow: "signup" },
      });
    }

    return {
      ok: true,
      message:
        isClientPortalPath(next)
          ? "Check your inbox to verify your email. If it is not there, check Spam or Promotions too. Clicking the link signs you in and opens your client portal."
          : "Check your inbox to verify your email. If it is not there, check Spam or Promotions too. Clicking the link signs you in and drops you into onboarding.",
    };
  } catch (err) {
    const message = userSafeErrorMessage(err);
    log.warn("auth.signup.unexpected_failed", {
      error: err instanceof Error ? err.message : String(err),
      user_message: message,
      email_hash: await safeHashedEmail(email),
    });
    await recordSecurityEvent({
      kind: "auth_signup_failed",
      severity: "info",
      metadata: {
        email_hash: await safeHashedEmail(email),
        reason: message,
      },
    });
    return {
      ok: false,
      error: isExistingAccountError(message)
        ? "An account with that email already exists. Try logging in instead, or reset your password."
        : message,
    };
  }
}

// --- login ------------------------------------------------------------------

export async function loginAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  // Two-key rate-limit:
  //   - Per (IP+email) to defend a single account against credential stuffing.
  //   - Per IP to catch broad sweeps across many emails.
  const ip = await getClientIp();
  const perAccount = await authLimit(`login:${ip}:${email.toLowerCase()}`);
  if (!perAccount.ok) {
    await recordSecurityEvent({
      kind: "auth_ratelimit_tripped",
      severity: "warn",
      metadata: {
        flow: "login",
        scope: "account",
        email_hash: await hashedEmail(email),
      },
    });
    return { ok: false, error: perAccount.message };
  }
  const perIp = await authLimit(`login-ip:${ip}`);
  if (!perIp.ok) {
    await recordSecurityEvent({
      kind: "auth_ratelimit_tripped",
      severity: "warn",
      metadata: { flow: "login", scope: "ip" },
    });
    return { ok: false, error: perIp.message };
  }

  const supabase = await getServerSupabase();

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    const serviceUnavailable = isAuthServiceUnavailable(error);
    log.warn("auth.login.supabase_failed", {
      error_code: (error as { code?: unknown }).code,
      error_status: (error as { status?: unknown }).status,
      error_name: error.name,
      error_message: error.message,
      service_unavailable: serviceUnavailable,
      email_hash: await safeHashedEmail(email),
    });
    // Audit-log the failed attempt with a hashed email so repeated
    // targeting of a single account is visible without storing the
    // plaintext address.
    await recordSecurityEvent({
      kind: "auth_login_failed",
      severity: "info",
      metadata: { email_hash: await hashedEmail(email) },
    });
    // Don't leak whether the email exists — generic message.
    return {
      ok: false,
      error: serviceUnavailable
        ? "The sign-in service is temporarily unavailable. Please try again in a moment."
        : "Invalid email or password.",
    };
  }

  // Success: identify in analytics + fire the login event. Both are
  // fire-and-forget and never throw.
  if (signInData.user) {
    await identifyServer(signInData.user.id, { email: signInData.user.email });
    await trackServerEvent(signInData.user.id, "auth.user.logged_in");
  }

  // Route admins straight to /admin and skip the freelancer dashboard
  // entirely. An admin who explicitly came from a deep `next=` link still
  // honours that destination so internal links keep working.
  const rawNext = formData.get("next")?.toString() ?? null;
  const role = (signInData.user?.app_metadata as { role?: unknown } | null)
    ?.role;
  if (role === "admin" && !rawNext) {
    redirect("/admin");
  }

  const next = sanitiseNext(rawNext);
  redirect(next);
}

// --- client portal code login ----------------------------------------------

export async function requestPortalCodeAction(
  _prev: ActionResult<{ email: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ email: string }>> {
  const parsed = portalCodeRequestSchema.safeParse({
    email: formData.get("portalEmail"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter the client email used for the portal invite.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getClientIp();
  const gate = await authLimit(`portal-code:${ip}:${email}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  const genericMessage =
    "If this email has portal access, we've sent a one-time code.";

  const accessContext = await getPortalEmailAccessContext(email);
  if (!accessContext) {
    return { ok: true, data: { email }, message: genericMessage };
  }

  const admin = getAdminSupabase();
  const origin = await getOrigin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/portal")}`,
      data: { full_name: email.split("@")[0], auth_context: "client_portal" },
    },
  });

  const code = data.properties?.email_otp ?? null;
  if (error || !code) {
    log.warn("auth.portal_code.request_failed", {
      error: error?.message ?? "missing_email_otp",
      email_hash: await safeHashedEmail(email),
    });
    return {
      ok: false,
      error: "We couldn't send the code right now. Please try again.",
    };
  }

  const rendered = renderPortalAccessCodeEmail({
    code,
    portalName: accessContext.portalName,
    expiresMinutes: 10,
  });
  const delivery = await dispatchDelivery({
    userId: accessContext.ownerUserId,
    kind: "portal_invite",
    entityType: "system",
    entityId: accessContext.portalId,
    senderType: "connect",
    to: { email },
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    metadata: {
      flow: "portal_code",
      portalId: accessContext.portalId,
    },
    tags: ["portal", "code"],
    idempotencyKey: `portal-code:${email}:${code}`,
  });

  if (!delivery.ok) {
    return {
      ok: false,
      error: "We couldn't send the code right now. Please try again.",
    };
  }

  return { ok: true, data: { email }, message: genericMessage };
}

export async function verifyPortalCodeAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = portalCodeVerifySchema.safeParse({
    email: formData.get("portalEmail"),
    code: formData.get("portalCode"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter the code from your email.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const email = parsed.data.email.toLowerCase();
  const ip = await getClientIp();
  const gate = await authLimit(`portal-code-verify:${ip}:${email}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.code,
    type: "email",
  });

  if (error) {
    await recordSecurityEvent({
      kind: "auth_login_failed",
      severity: "info",
      metadata: {
        flow: "portal_code",
        email_hash: await safeHashedEmail(email),
      },
    });
    return { ok: false, error: "Invalid or expired code." };
  }

  const verifiedUser = data.user;
  if (!verifiedUser) {
    return {
      ok: false,
      error: "We verified the code but could not open the portal. Try again.",
    };
  }

  const activated = await activatePortalAccessForUser({
    email,
    userId: verifiedUser.id,
    userEmail: verifiedUser.email ?? null,
  });
  if (!activated.ok) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        activated.error ??
        "No active client portal was found for this email.",
    };
  }

  const portalIds = activated.data?.portalIds ?? [];
  redirect(portalIds.length === 1 ? portalClientHome(portalIds[0]!) : "/portal");
}

// --- logout -----------------------------------------------------------------

export async function logoutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect(AUTH_LOGIN_ROUTE);
}

// --- forgot password --------------------------------------------------------

export async function forgotPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please enter a valid email.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Per-IP+email rate-limit on reset-mail to prevent inbox flooding.
  const ip = await getClientIp();
  const gate = await passwordResetLimit(
    `pwreset:${ip}:${parsed.data.email.toLowerCase()}`,
  );
  // Note: we still return success below to avoid leaking account existence,
  // but the actual mail is suppressed when the limiter trips.
  const limited = !gate.ok;

  // Audit log covers both the legitimate request AND the ratelimit
  // trip. A spike in either is a signal worth investigating.
  await recordSecurityEvent({
    kind: limited
      ? "auth_ratelimit_tripped"
      : "auth_password_reset_requested",
    severity: limited ? "warn" : "info",
    metadata: {
      flow: "password_reset",
      email_hash: await hashedEmail(parsed.data.email),
    },
  });

  const supabase = await getServerSupabase();
  const origin = await getOrigin();

  if (limited) {
    return {
      ok: true,
      message:
        "If an account exists for that email, we've sent password reset instructions.",
    };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
        "/reset-password",
      )}`,
    },
  );

  // Return success even if the email doesn't exist — do not leak account
  // presence via this endpoint.
  if (error && process.env.NODE_ENV === "development") {
    console.error("[auth] resetPasswordForEmail:", error.message);
  }

  return {
    ok: true,
    message:
      "If an account exists for that email, we've sent password reset instructions.",
  };
}

// --- reset password (from reset link) --------------------------------------

export async function resetPasswordAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    message: "Password updated. You can now log in with your new password.",
  };
}

// --- Google OAuth ------------------------------------------------------------
// Initiates the OAuth flow. The browser is redirected to Google, which then
// redirects back to /auth/callback where the session is finalised.
export async function googleOAuthAction(formData: FormData): Promise<void> {
  const supabase = await getServerSupabase();
  const origin = await getOrigin();
  const next = sanitiseNext(formData.get("next")?.toString() ?? null);
  // Which auth page launched this action (login | signup). Used to redirect
  // errors back to the originating page so the user sees the error in context.
  const from = formData.get("from")?.toString() === "signup" ? "/signup" : AUTH_LOGIN_ROUTE;
  const cookieStore = await cookies();

  cookieStore.set("stackivo_oauth_next", next, {
    httpOnly: true,
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });
  cookieStore.set("stackivo_oauth_from", from, {
    httpOnly: true,
    maxAge: 5 * 60,
    path: "/",
    sameSite: "lax",
    secure: origin.startsWith("https://"),
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        // Request a refresh token so long-lived sessions work.
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error || !data?.url) {
    redirect(`${from}?error=oauth_unavailable`);
  }
  redirect(data.url);
}
