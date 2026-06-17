import "server-only";

/**
 * Server-side billing service.
 *
 * Responsibilities:
 *   - Resolve the current user's billing snapshot
 *   - Lazily ensure a Razorpay customer exists per user
 *   - Create / cancel / sync Razorpay subscriptions
 *   - Mirror Razorpay state into the `subscriptions` row so feature gating
 *     stays in sync without webhook latency
 *
 * Read-side helpers in `@/features/subscription/server` continue to power
 * feature/limit gating — they read the same `subscriptions` row.
 */

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { publicRazorpayKeyId, requireServerEnv } from "@/config/env";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import type {
  BillingPaymentRow,
  SubscriptionRow,
} from "@/lib/supabase/types";
import {
  cancelSubscription as rzpCancelSubscription,
  createCustomer as rzpCreateCustomer,
  createSubscription as rzpCreateSubscription,
  fetchSubscription as rzpFetchSubscription,
  type RazorpaySubscription,
} from "./razorpay/client";
import { getRazorpayPlanId } from "./razorpay/plan-mapping";
import { mapRazorpayStatus } from "./state";
import {
  mapPaymentRow,
  type BillingPayment,
  type BillingSubscription,
  type CheckoutSession,
  type StartCheckoutInput,
} from "./types";

// --- Loaders ---------------------------------------------------------------

function mapSubscriptionRow(row: SubscriptionRow): BillingSubscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    billingCycle: row.billing_cycle,
    razorpaySubscriptionId: row.razorpay_subscription_id,
    razorpayCustomerId: row.razorpay_customer_id,
    razorpayPlanId: row.razorpay_plan_id,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    canceledAt: row.canceled_at,
    endedAt: row.ended_at,
    lastPaymentAt: row.last_payment_at,
    nextChargeAt: row.next_charge_at,
    gracePeriodEndsAt: row.grace_period_ends_at,
  };
}

export async function getBillingSubscription(): Promise<BillingSubscription | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return mapSubscriptionRow(data as unknown as SubscriptionRow);
}

export async function listBillingPayments(limit = 25): Promise<BillingPayment[]> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as BillingPaymentRow[];
  return rows.map(mapPaymentRow);
}

// --- Customer provisioning -------------------------------------------------

/**
 * Ensure the current user has a Razorpay customer id stored on their
 * `subscriptions` row. Idempotent.
 */
async function ensureRazorpayCustomer(userId: string): Promise<string> {
  const admin = getAdminSupabase();

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const sub = subRow as unknown as SubscriptionRow | null;
  if (sub?.razorpay_customer_id) return sub.razorpay_customer_id;

  const { data: profileRow } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  const profile = profileRow as { full_name: string; email: string } | null;
  if (!profile) {
    throw new Error("[billing] Cannot create Razorpay customer: profile missing");
  }

  const customer = await rzpCreateCustomer({
    name: profile.full_name || profile.email,
    email: profile.email,
    notes: { user_id: userId },
  });

  await admin
    .from("subscriptions")
    .update({ razorpay_customer_id: customer.id } as never)
    .eq("user_id", userId);

  return customer.id;
}

// --- Checkout --------------------------------------------------------------

function razorpayKeyMode(key: string): "test" | "live" | "unknown" {
  if (key.startsWith("rzp_test_")) return "test";
  if (key.startsWith("rzp_live_")) return "live";
  return "unknown";
}

function resolveCheckoutKeyId(env: ReturnType<typeof requireServerEnv>): string {
  if (!env.razorpayKeyId) {
    throw new Error("[billing] RAZORPAY_KEY_ID is not configured.");
  }

  if (publicRazorpayKeyId && publicRazorpayKeyId !== env.razorpayKeyId) {
    throw new Error(
      `[billing] Razorpay checkout key mismatch: NEXT_PUBLIC_RAZORPAY_KEY_ID is ${razorpayKeyMode(
        publicRazorpayKeyId,
      )}, but RAZORPAY_KEY_ID is ${razorpayKeyMode(
        env.razorpayKeyId,
      )}. Use the same Razorpay key id for both values.`,
    );
  }

  return publicRazorpayKeyId ?? env.razorpayKeyId;
}

/**
 * Create a Razorpay subscription and return the data the browser needs
 * to launch Razorpay Checkout. The DB row is updated to point at the new
 * subscription id immediately so webhook handlers can find it.
 */
export async function startCheckout(
  input: StartCheckoutInput,
): Promise<CheckoutSession> {
  const env = requireServerEnv();
  const checkoutKeyId = resolveCheckoutKeyId(env);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const customerId = await ensureRazorpayCustomer(user.id);
  const razorpayPlanId = getRazorpayPlanId(input.plan, input.cycle);

  const subscription = await rzpCreateSubscription({
    planId: razorpayPlanId,
    customerId,
    notes: {
      user_id: user.id,
      plan: input.plan,
      cycle: input.cycle,
    },
  });

  // Stage the row so when Razorpay sends `subscription.activated` the
  // webhook handler can look up by `razorpay_subscription_id` and the
  // user sees their new state immediately on return from checkout.
  const admin = getAdminSupabase();
  await admin
    .from("subscriptions")
    .update({
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: razorpayPlanId,
      billing_cycle: input.cycle,
      // Don't flip plan/status until payment is captured. Marketing copy
      // makes this clear: paid features unlock after first successful charge.
      cancel_at_period_end: false,
      canceled_at: null,
      ended_at: null,
    } as never)
    .eq("user_id", user.id);

  const { data: profileRow } = await admin
    .from("user_profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();
  const profile =
    (profileRow as { full_name: string; email: string } | null) ?? null;

  return {
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url,
    keyId: checkoutKeyId,
    prefill: {
      name: profile?.full_name ?? undefined,
      email: profile?.email ?? user.email ?? undefined,
    },
    notes: {
      user_id: user.id,
      plan: input.plan,
      cycle: input.cycle,
    },
  };
}

// --- Cancel / Reactivate ---------------------------------------------------

export async function cancelCurrentSubscription(opts: {
  immediate?: boolean;
} = {}): Promise<BillingSubscription> {
  const sub = await getBillingSubscription();
  if (!sub) throw new Error("No active subscription to cancel.");
  if (!sub.razorpaySubscriptionId) {
    // No remote subscription yet (e.g. checkout abandoned) — just clear locally.
    const admin = getAdminSupabase();
    await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: false,
        canceled_at: new Date().toISOString(),
        status: "canceled",
        plan: "free",
      } as never)
      .eq("user_id", sub.userId);
    return (await getBillingSubscription())!;
  }

  const cancelAtCycleEnd = !opts.immediate;
  const updated = await rzpCancelSubscription(
    sub.razorpaySubscriptionId,
    cancelAtCycleEnd,
  );

  await syncSubscriptionFromRazorpay(updated, sub.userId);
  return (await getBillingSubscription())!;
}

/**
 * "Reactivate" semantics:
 *   - If the existing remote subscription is still on `cancel_at_cycle_end`,
 *     we just clear the local flag and let the next charge run normally.
 *     Razorpay does not expose a public "uncancel" endpoint, so for fully
 *     cancelled subscriptions we open a fresh checkout for the same plan.
 */
export async function reactivateCurrentSubscription(): Promise<
  | { status: "kept"; subscription: BillingSubscription }
  | { status: "needs_checkout"; checkout: CheckoutSession }
> {
  const sub = await getBillingSubscription();
  if (!sub) throw new Error("No subscription to reactivate.");

  // Razorpay has no API to un-cancel a subscription — not even one merely
  // scheduled to cancel at cycle end. Clearing our local flag would leave the
  // remote mandate still cancelling, so the user would silently lose access at
  // period end. Reactivation therefore always means a fresh subscription +
  // mandate via checkout. (The old, cancel-scheduled subscription does not
  // charge again, so there is no double-debit at its cycle end.)
  const checkout = await startCheckout({
    plan: sub.plan === "free" ? "pro" : sub.plan,
    cycle: sub.billingCycle,
  });
  return { status: "needs_checkout", checkout };
}

// --- Sync from Razorpay (used by webhooks & manual refresh) ---------------

/**
 * Mirror the latest Razorpay subscription state into the local row.
 * Used by webhook handlers and as a manual "refresh" button on the
 * billing dashboard. Idempotent.
 */
export async function syncSubscriptionFromRazorpay(
  rzp: RazorpaySubscription,
  userIdHint?: string,
): Promise<void> {
  const admin = getAdminSupabase();
  const userId =
    userIdHint ??
    (rzp.notes && typeof rzp.notes.user_id === "string"
      ? rzp.notes.user_id
      : undefined);

  let userIdResolved = userId;
  if (!userIdResolved) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("razorpay_subscription_id", rzp.id)
      .maybeSingle();
    userIdResolved = (data as { user_id: string } | null)?.user_id;
  }
  if (!userIdResolved) {
    // Nothing to update — payment came in before checkout linked the row.
    return;
  }

  const { findPlanByRazorpayId } = await import("./razorpay/plan-mapping");
  const planResolved = findPlanByRazorpayId(rzp.plan_id);
  const status = mapRazorpayStatus(rzp.status);
  const isPaidNow = status === "active" || status === "trialing";

  const updates: Partial<SubscriptionRow> = {
    razorpay_subscription_id: rzp.id,
    razorpay_plan_id: rzp.plan_id,
    status,
    plan: isPaidNow && planResolved ? planResolved.plan : "free",
    billing_cycle: planResolved?.cycle ?? "monthly",
    current_period_start: rzp.current_start
      ? new Date(rzp.current_start * 1000).toISOString()
      : null,
    current_period_end: rzp.current_end
      ? new Date(rzp.current_end * 1000).toISOString()
      : null,
    next_charge_at: rzp.charge_at
      ? new Date(rzp.charge_at * 1000).toISOString()
      : null,
    ended_at: rzp.ended_at ? new Date(rzp.ended_at * 1000).toISOString() : null,
    cancel_at_period_end: rzp.status === "active" && rzp.ended_at !== null,
  };

  if (rzp.status === "cancelled") {
    updates.canceled_at = new Date().toISOString();
  }

  // Past-due gets a 3-day grace window on first detection.
  if (status === "past_due") {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("grace_period_ends_at")
      .eq("user_id", userIdResolved)
      .maybeSingle();
    const existingGrace = (existing as { grace_period_ends_at: string | null } | null)
      ?.grace_period_ends_at;
    if (!existingGrace) {
      updates.grace_period_ends_at = new Date(
        Date.now() + 3 * 86_400_000,
      ).toISOString();
    }
  } else {
    updates.grace_period_ends_at = null;
  }

  await admin
    .from("subscriptions")
    .update(updates as never)
    .eq("user_id", userIdResolved);
}

/** Manual refresh: re-fetch from Razorpay and mirror into the DB. */
export async function refreshCurrentSubscription(): Promise<BillingSubscription | null> {
  const sub = await getBillingSubscription();
  if (!sub?.razorpaySubscriptionId) return sub;
  const rzp = await rzpFetchSubscription(sub.razorpaySubscriptionId);
  await syncSubscriptionFromRazorpay(rzp, sub.userId);
  return getBillingSubscription();
}
