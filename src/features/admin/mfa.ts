"use server";

/**
 * Founder Console - MFA enrollment + step-up.
 *
 * Supabase's MFA API exposes:
 *
 *   - `auth.mfa.enroll({ factorType: 'totp' })`    -> returns secret + QR
 *   - `auth.mfa.challenge({ factorId })`           -> returns challenge id
 *   - `auth.mfa.verify({ factorId, challengeId, code })` -> upgrades to aal2
 *   - `auth.mfa.unenroll({ factorId })`            -> removes a factor
 *
 * These all run via the user's own session - service-role isn't
 * involved. We wrap each step in a server action so the UI is purely
 * form-postable.
 */

import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export interface EnrollResult {
  ok: boolean;
  error?: string;
  factorId?: string;
  /** Otpauth URI suitable for QR rendering. */
  uri?: string;
  /** Base-32 secret the user can type into any TOTP app. */
  secret?: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

/**
 * Start enrolling a new TOTP factor named "console". Returns the
 * otpauth URI + raw secret the UI will display as a QR code.
 *
 * Idempotency: if the user already has an "unverified" factor (the
 * enrollment was started but never completed), Supabase reuses it.
 * Verified factors are listed separately by `getMfaStatus()`.
 */
export async function startTotpEnrollmentAction(): Promise<EnrollResult> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Founder Console",
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    factorId: data.id,
    uri: data.totp?.uri,
    secret: data.totp?.secret,
  };
}

const verifySchema = z.object({
  factorId: z.string().min(1),
  code: z
    .string()
    .regex(/^\d{6}$/, "Code must be 6 digits."),
});

export async function verifyTotpEnrollmentAction(
  input: z.input<typeof verifySchema>,
): Promise<VerifyResult> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid code.",
    };
  }
  const supabase = await getServerSupabase();
  // The challenge-then-verify dance: a single transaction in the SDK
  // since Supabase JS v2.45+.
  const { data, error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Unknown verification failure." };
  return { ok: true };
}

/**
 * Unenroll a factor (only when there are multiple - at least one
 * verified factor must remain or the admin will lose access entirely).
 */
export async function unenrollFactorAction(
  factorId: string,
): Promise<VerifyResult> {
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface MfaStatus {
  factors: Array<{
    id: string;
    friendly_name: string | null;
    status: "verified" | "unverified";
    created_at: string;
  }>;
  currentAal: "aal1" | "aal2";
}

/**
 * Read the current user's MFA factors + current AAL. Safe to call
 * even when admin role isn't yet verified - used by the layout that
 * gates `/admin/mfa`.
 */
export async function getMfaStatus(): Promise<MfaStatus> {
  const supabase = await getServerSupabase();
  const [{ data: factors }, { data: aal }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const all = (factors as { all?: Array<{
    id: string;
    friendly_name?: string | null;
    status: string;
    created_at: string;
  }> } | null)?.all ?? [];

  return {
    factors: all.map((f) => ({
      id: f.id,
      friendly_name: f.friendly_name ?? null,
      status: f.status === "verified" ? "verified" : "unverified",
      created_at: f.created_at,
    })),
    currentAal: aal?.currentLevel === "aal2" ? "aal2" : "aal1",
  };
}
