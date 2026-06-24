"use server";

/**
 * Account-lifecycle server actions kept out of the large auth/actions.ts:
 *   - changePasswordAction      — authenticated in-app password change.
 *   - requestAccountDeletionAction — start the 30-day grace-then-purge flow.
 *   - cancelAccountDeletionAction  — undo a pending deletion within the window.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { recordSecurityEvent } from "@/lib/security-events/server";
import { authLimit, getClientIp } from "@/lib/rate-limit";
import { changePasswordSchema } from "./schemas";
import { log } from "@/lib/logger";

export interface AccountActionResult {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

/** Days a deletion-requested account is retained before the cron hard-purges. */
const DELETION_GRACE_DAYS = 30;

// --- Password change --------------------------------------------------------

export async function changePasswordAction(
  _prev: AccountActionResult | undefined,
  formData: FormData,
): Promise<AccountActionResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "You are not signed in." };

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Rate-limit per user+IP to stop brute-forcing the current password.
  const ip = await getClientIp();
  const gate = await authLimit(`pwchange:${ip}:${user.id}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  // Re-authenticate: verify the CURRENT password before allowing a change.
  // A failed sign-in does not disturb the existing session.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (reauthErr) {
    await recordSecurityEvent({
      kind: "auth_login_failed",
      severity: "warn",
      userId: user.id,
      metadata: { flow: "password_change_reauth" },
    });
    return { ok: false, error: "Your current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) {
    log.warn("auth.password_change.failed", { error: error.message });
    return { ok: false, error: "Could not update your password. Please try again." };
  }

  await recordSecurityEvent({
    kind: "auth_password_changed",
    severity: "info",
    userId: user.id,
    metadata: { flow: "settings" },
  });
  return { ok: true, message: "Your password has been updated." };
}

// --- Account deletion (grace period -> purge) -------------------------------

export async function requestAccountDeletionAction(
  _prev: AccountActionResult | undefined,
  formData: FormData,
): Promise<AccountActionResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "You are not signed in." };

  // Require typed confirmation so deletion can't be triggered accidentally.
  const confirmText = (formData.get("confirmText")?.toString() ?? "").trim();
  if (confirmText.toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm account deletion.' };
  }

  // Re-authenticate with the current password (defence against an unattended
  // session). Skipped only for OAuth-only accounts that have no password set.
  const password = formData.get("password")?.toString() ?? "";
  if (password) {
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (reauthErr) return { ok: false, error: "Your password is incorrect." };
  }

  const now = new Date();
  const scheduled = new Date(
    now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000,
  );

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("user_profiles")
    .update({
      deletion_status: "pending_deletion",
      deletion_requested_at: now.toISOString(),
      deletion_scheduled_at: scheduled.toISOString(),
    } as never)
    .eq("id", user.id);
  if (error) {
    log.error("account.deletion_request.failed", { error: error.message });
    return { ok: false, error: "Could not start deletion. Please try again." };
  }

  await recordSecurityEvent({
    kind: "account_deletion_requested",
    severity: "warn",
    userId: user.id,
    metadata: { scheduled_at: scheduled.toISOString(), grace_days: DELETION_GRACE_DAYS },
  });

  return {
    ok: true,
    message: `Your account is scheduled for permanent deletion on ${scheduled.toDateString()}. You can cancel any time before then by signing in.`,
  };
}

export async function cancelAccountDeletionAction(): Promise<AccountActionResult> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You are not signed in." };

  const admin = getAdminSupabase();
  const { error } = await admin
    .from("user_profiles")
    .update({
      deletion_status: "active",
      deletion_requested_at: null,
      deletion_scheduled_at: null,
    } as never)
    .eq("id", user.id);
  if (error) {
    return { ok: false, error: "Could not cancel deletion. Please try again." };
  }

  await recordSecurityEvent({
    kind: "account_deletion_cancelled",
    severity: "info",
    userId: user.id,
  });
  return { ok: true, message: "Your account deletion has been cancelled." };
}


export interface DeletionStatus {
  pending: boolean;
  scheduledAt: string | null;
}

/** Read the signed-in user's deletion status (so a returning user can cancel). */
export async function getAccountDeletionStatus(): Promise<DeletionStatus> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { pending: false, scheduledAt: null };

  const { data } = await supabase
    .from("user_profiles")
    .select("deletion_status, deletion_scheduled_at")
    .eq("id", user.id)
    .maybeSingle();
  const row = data as
    | { deletion_status?: string; deletion_scheduled_at?: string | null }
    | null;
  return {
    pending: row?.deletion_status === "pending_deletion",
    scheduledAt: row?.deletion_scheduled_at ?? null,
  };
}
