/**
 * Founder Console - server primitives.
 *
 * These are the ONLY entry points server code should use to gate or
 * audit admin operations. They are deliberately small and centralized
 * so behaviour can evolve in one place (e.g. add MFA / aal2 check
 * later, swap audit sink, etc.).
 *
 *   requireAdmin()        - gate; redirects/404s non-admins, returns user.
 *   runAdminAction()      - wraps every admin WRITE with audit + timing.
 *   recordAdminAction()   - low-level audit writer; usually called by
 *                            runAdminAction(). Public for special cases
 *                            (e.g. logging a read-only inspection).
 *   assertNotViewAs()     - refuse writes while in view-as session.
 *
 * Authorization signal: `ADMIN_EMAIL` environment variable.
 * Any authenticated user whose email matches this env var is treated as
 * the admin. The legacy SQL role (`auth.users.raw_app_meta_data->>'role'
 * = 'admin'`) is honoured as a fallback so existing sessions keep working,
 * but the canonical gate is the env var - no SQL required.
 *
 * Set in .env.local (dev) and Vercel Environment Variables (prod):
 *   ADMIN_EMAIL=founder@yourcompany.com
 */

import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/security-events/server";
import { adminWriteLimit } from "@/lib/rate-limit";
import { redact } from "@/lib/logger/redact";
import { log } from "@/lib/logger";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import type {
  AdminActionTargetType,
  AdminActionRow,
} from "@/lib/supabase/types";
import type {
  AdminActionDescriptor,
  AdminActionKind,
  AdminActionMetadata,
} from "./types";

/**
 * Cookie used to persist a "View as user" session for the admin. The
 * value is the target user's UUID. Reads inside admin routes that
 * support view-as honour this; writes call `assertNotViewAs()` to
 * refuse mutation while it's set.
 *
 * Single source of truth - do not stringify this anywhere else.
 */
export const VIEW_AS_COOKIE = "stk_admin_view_as";

// ---------------------------------------------------------------------------
// Role check
// ---------------------------------------------------------------------------

/**
 * Returns the admin's auth user.
 *
 * Failure modes:
 *   - Not authenticated -> redirect to /login.
 *   - Authenticated but not admin -> 404 (don't confirm the surface exists)
 *     AND record a `rls_guard_miss` security event for forensics.
 *
 * The 404-vs-403 choice is deliberate: a 403 confirms `/admin/*` exists
 * to an attacker who guesses the URL. A 404 makes the surface
 * indistinguishable from a missing page.
 */
/**
 * Request-scoped auth lookup.
 *
 * `supabase.auth.getUser()` is a network round-trip to Supabase Auth. It
 * gets called from the admin layout AND from the page on every navigation
 * (plus any nested server components). React's `cache()` memoizes the call
 * for the lifetime of a single request render, so the whole tree shares one
 * round-trip instead of paying it two or three times. This is the single
 * biggest latency win for the console.
 */
const getAuthedUser = cache(async (): Promise<User | null> => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

export const requireAdmin = cache(async function requireAdmin(): Promise<User> {
  const supabase = await getServerSupabase();
  const user = await getAuthedUser();

  if (!user) {
    // Send through the normal login flow; user can come back via the
    // standard `next=` redirect after auth.
    redirect(AUTH_LOGIN_ROUTE);
  }

  if (!isAdminUser(user)) {
    await recordSecurityEvent({
      kind: "rls_guard_miss",
      severity: "alert",
      userId: user.id,
      metadata: { surface: "admin" },
    });
    notFound();
  }

  // MFA gate. Production REQUIRES aal2 (TOTP / WebAuthn enrolled +
  // verified in this session). Non-production bypasses so local
  // testing without a real TOTP device still works.
  //
  // The dedicated `/admin/mfa` page handles enrollment + step-up; we
  // skip the check there so the admin can reach it.
  if (process.env.NODE_ENV === "production") {
    const aal = await readAal(supabase);
    if (aal !== "aal2") {
      const path = await currentPath();
      if (!path.startsWith("/admin/mfa")) {
        redirect("/admin/mfa");
      }
    }
  }

  return user;
});

/**
 * Resolve the session's current Authenticator Assurance Level.
 * Returns "aal1" (single-factor) or "aal2" (MFA-stepped). Defaults to
 * aal1 on any error so we fail closed.
 */
async function readAal(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<"aal1" | "aal2"> {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.currentLevel === "aal2" ? "aal2" : "aal1";
  } catch {
    return "aal1";
  }
}

async function currentPath(): Promise<string> {
  try {
    const h = await headers();
    // x-pathname is set by our middleware on every request so it's always
    // available in server components. x-invoke-path is a Next.js internal
    // that isn't reliably present on Vercel's Edge runtime.
    return (
      h.get("x-pathname") ??
      h.get("x-invoke-path") ??
      h.get("next-url") ??
      ""
    );
  } catch {
    return "";
  }
}

/**
 * Returns true if the user should be treated as an admin.
 *
 * Primary check: `ADMIN_EMAIL` env var - the company email set in
 * Vercel environment variables. No SQL needed.
 *
 * Fallback: legacy `role = 'admin'` in app_metadata, for backward
 * compatibility with any session that was granted via SQL.
 */
function isAdminUser(user: User): boolean {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  if (adminEmail && user.email?.toLowerCase() === adminEmail) return true;
  const meta = user.app_metadata as { role?: unknown } | null | undefined;
  return meta?.role === "admin";
}

/**
 * Same checks as `requireAdmin()` but returns `null` instead of
 * redirecting. Useful for layouts that render shared chrome
 * (e.g. middleware-level redirects already handled).
 */
export const getAdminOrNull = cache(async (): Promise<User | null> => {
  const user = await getAuthedUser();
  if (!user) return null;
  return isAdminUser(user) ? user : null;
});

// ---------------------------------------------------------------------------
// View-as
// ---------------------------------------------------------------------------

/**
 * Returns the UUID of the user the admin is currently "viewing as," or
 * null if no view-as session is active.
 */
export const getViewAsUserId = cache(async (): Promise<string | null> => {
  const jar = await cookies();
  const val = jar.get(VIEW_AS_COOKIE)?.value;
  return val && /^[0-9a-f-]{36}$/.test(val) ? val : null;
});

/**
 * Throws if a view-as session is active. Every server action that
 * MUTATES data must call this - view-as is read-only by design.
 */
export async function assertNotViewAs(): Promise<void> {
  const viewing = await getViewAsUserId();
  if (viewing) {
    throw new Error(
      "Writes are disabled while viewing as another user. Exit view-as first.",
    );
  }
}

// ---------------------------------------------------------------------------
// Audit writes
// ---------------------------------------------------------------------------

interface RecordAdminActionInput {
  actorId: string;
  kind: AdminActionKind;
  targetType: AdminActionTargetType;
  targetId: string | null;
  success: boolean;
  durationMs: number;
  metadata?: AdminActionMetadata;
}

/**
 * Low-level audit writer. Fire-and-forget: a failed audit MUST NOT
 * fail the admin action itself (Sentry will see the warning). Most
 * code should call `runAdminAction()` instead which wraps the body
 * with timing + try/catch.
 */
export async function recordAdminAction(
  input: RecordAdminActionInput,
): Promise<void> {
  try {
    const admin = getAdminSupabase();
    const requestId = await resolveRequestId();
    await admin.from("admin_actions").insert({
      actor_id: input.actorId,
      kind: input.kind,
      target_type: input.targetType,
      target_id: input.targetId,
      success: input.success,
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      metadata: redact(input.metadata ?? {}) as never,
      request_id: requestId,
    } as never);
  } catch (err) {
    // The audit write itself failed. Surface to logs + Sentry but
    // never re-throw.
    log.warn("admin.audit.write_failed", {
      kind: input.kind,
      target_type: input.targetType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function resolveRequestId(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-request-id");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// runAdminAction - the wrapper every write goes through
// ---------------------------------------------------------------------------

/**
 * Wraps an admin write with auth check, view-as refusal, timing, and
 * audit logging.
 *
 *   const result = await runAdminAction(
 *     { kind: "subscription.refund", targetType: "subscription", targetId: subId,
 *       metadata: { reason } },
 *     async (actor) => {
 *       // ...mutate...
 *       return { ok: true };
 *     },
 *   );
 *
 * The function:
 *   1. Calls `requireAdmin()` - every write re-checks role at the call site.
 *   2. Calls `assertNotViewAs()` - view-as mode is read-only.
 *   3. Times the body.
 *   4. Audits success or failure to `admin_actions`.
 *   5. Re-throws on body failure so the caller can react.
 *
 * The body receives the admin's auth user so it can attribute the
 * mutation server-side (e.g. set `metadata.actor_id`).
 */
export async function runAdminAction<T>(
  descriptor: AdminActionDescriptor,
  body: (actor: User) => Promise<T>,
): Promise<T> {
  const actor = await requireAdmin();
  await assertNotViewAs();

  // Abuse ceiling: stop a runaway script or compromised session from hammering
  // mutations. Generous (120/min/admin); fails open without Upstash.
  const rl = await adminWriteLimit(`admin:${actor.id}`);
  if (!rl.ok) {
    await recordSecurityEvent({
      kind: "other",
      severity: "warn",
      userId: actor.id,
      metadata: { reason: "admin_rate_limit", action: descriptor.kind },
    }).catch(() => {});
    throw new Error(rl.message);
  }

  const start = performance.now();
  try {
    const result = await body(actor);
    const failureMessage = resultFailureMessage(result);
    await recordAdminAction({
      actorId: actor.id,
      kind: descriptor.kind,
      targetType: descriptor.targetType,
      targetId: descriptor.targetId,
      success: !failureMessage,
      durationMs: performance.now() - start,
      metadata: failureMessage
        ? { ...(descriptor.metadata ?? {}), error: failureMessage }
        : descriptor.metadata,
    });
    return result;
  } catch (err) {
    await recordAdminAction({
      actorId: actor.id,
      kind: descriptor.kind,
      targetType: descriptor.targetType,
      targetId: descriptor.targetId,
      success: false,
      durationMs: performance.now() - start,
      metadata: {
        ...(descriptor.metadata ?? {}),
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

function resultFailureMessage(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const envelope = result as { ok?: unknown; error?: unknown };
  if (envelope.ok !== false) return null;
  return typeof envelope.error === "string" && envelope.error.trim()
    ? envelope.error
    : "Action returned ok=false.";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convenience: list the most recent admin_actions rows. Used by both
 * the Now page (last 10) and the dedicated /admin/audit list.
 */
export async function listRecentAdminActions(
  limit = 25,
): Promise<AdminActionRow[]> {
  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("admin_actions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    log.warn("admin.audit.list_failed", { error: error.message });
    return [];
  }
  return (data ?? []) as AdminActionRow[];
}
