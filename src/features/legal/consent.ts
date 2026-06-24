import "server-only";

/**
 * DPDP Act consent recording.
 *
 * India's Digital Personal Data Protection Act, 2023 requires a data
 * fiduciary to be able to *prove* that a data principal gave free, specific,
 * informed, unambiguous consent for a stated purpose. A pre-ticked or
 * purely client-side checkbox is not provable. This module records an
 * append-only, versioned, timestamped consent row server-side.
 *
 * Bump the *_VERSION constants whenever the Terms or Privacy Policy change
 * materially — new consent rows then capture exactly which version each user
 * agreed to.
 */

import crypto from "node:crypto";
import { headers } from "next/headers";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

/** Document versions currently in force. Date-based for auditability. */
export const TERMS_VERSION = "2026-06-24";
export const PRIVACY_VERSION = "2026-06-24";

/**
 * The exact statement a user accepts at signup. Shown verbatim next to the
 * checkbox AND hashed into the consent record so we can prove what was shown.
 */
export const SIGNUP_CONSENT_STATEMENT =
  "I have read and agree to the Terms of Service and the Privacy Policy, and " +
  "I consent to Stackivo processing my personal data for the purposes of " +
  "creating and operating my account, as described in the Privacy Policy.";

export type ConsentMethod = "checkbox" | "oauth" | "email_verify";

async function requestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    const ip = xff ? xff.split(",")[0]?.trim() ?? null : h.get("x-real-ip");
    return { ip: ip ?? null, ua: h.get("user-agent") ?? null };
  } catch {
    return { ip: null, ua: null };
  }
}

/**
 * Record a signup consent row. Idempotent: if the user already has a 'signup'
 * consent for the current document versions, it does nothing — so it is safe
 * to call from both the email-checkbox path and the OAuth callback. Never
 * throws (consent logging must not break auth); failures are logged.
 */
export async function recordConsentIfNeeded(
  userId: string,
  method: ConsentMethod,
): Promise<void> {
  try {
    const admin = getAdminSupabase();

    const { data: existing } = await admin
      .from("user_consents")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "signup")
      .eq("terms_version", TERMS_VERSION)
      .eq("privacy_version", PRIVACY_VERSION)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const { ip, ua } = await requestMeta();
    const consentHash = crypto
      .createHash("sha256")
      .update(`${TERMS_VERSION}|${PRIVACY_VERSION}|${SIGNUP_CONSENT_STATEMENT}`)
      .digest("hex");

    await admin.from("user_consents").insert({
      user_id: userId,
      kind: "signup",
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      consent_hash: consentHash,
      method,
      ip,
      user_agent: ua,
    } as never);
  } catch (err) {
    log.warn("consent.record_failed", {
      user_id: userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
