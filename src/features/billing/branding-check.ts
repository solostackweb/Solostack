import "server-only";

/**
 * Reusable plan check for public-page viral branding.
 *
 * Free-plan documents (invoices, contracts) carry a "create yours free"
 * growth CTA — the "get paid to advertise" mechanic. Paid (Pro/Business)
 * users have the custom-branding entitlement, so their public pages stay
 * clean / unbranded. This mirrors the gate used by the PDF builders but is
 * exported for use from public route handlers / pages.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { hasFeature } from "@/features/subscription/features";
import type { SubscriptionRow } from "@/lib/supabase/types";

export async function ownerHasCustomBranding(userId: string): Promise<boolean> {
  try {
    const admin = getAdminSupabase();
    const { data } = await admin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    const row = (data as unknown as SubscriptionRow | null) ?? null;
    return hasFeature(
      row
        ? {
            userId: row.user_id,
            plan: row.plan,
            status: row.status,
            trialEndsAt: row.trial_ends_at,
            currentPeriodEnd: row.current_period_end,
            razorpaySubscriptionId: row.razorpay_subscription_id,
          }
        : null,
      "invoices.custom_branding",
    );
  } catch {
    // Fail safe: treat as free (show CTA) rather than throw on a public page.
    return false;
  }
}
