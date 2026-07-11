"use server";

/**
 * Billing server actions.
 *
 * Wrap the server services in `./server.ts` with revalidate + clean
 * action-result envelopes the client can consume. These are the ONLY
 * billing entry points client components should call — never invoke the
 * Razorpay client from the browser.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cancelCurrentSubscription,
  reactivateCurrentSubscription,
  refreshCurrentSubscription,
  redeemFreeAccessCoupon,
  startCheckout,
} from "./server";
import { quoteCoupon, quoteWithoutCoupon } from "./coupons";
import { RazorpayApiError } from "./razorpay/client";
import type { CheckoutSession } from "./types";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const StartCheckoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  cycle: z.enum(["monthly", "yearly"]),
  couponCode: z.string().max(64).optional().nullable(),
});

const QuoteCheckoutSchema = StartCheckoutSchema;

function billingErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof RazorpayApiError && err.status === 401) {
    return "Razorpay authentication failed. Check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are copied from the same Razorpay test/live account, then restart the app.";
  }

  return err instanceof Error ? err.message : fallback;
}

export async function startCheckoutAction(
  raw: unknown,
): Promise<ActionResult<CheckoutSession>> {
  const parsed = StartCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid checkout selection." };
  }
  try {
    const session = await startCheckout(parsed.data);
    revalidatePath("/dashboard/settings/billing");
    return { ok: true, data: session };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Checkout failed."),
    };
  }
}

export async function quoteCheckoutAction(raw: unknown): Promise<
  ActionResult<{
    couponCode: string | null;
    subtotalPaise: number;
    discountPaise: number;
    totalPaise: number;
    currency: "INR";
    message: string | null;
    freeAccessDays: number | null;
  }>
> {
  const parsed = QuoteCheckoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid checkout selection." };
  }

  try {
    const { getServerSupabase } = await import("@/lib/supabase/server");
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sign in to apply coupons." };

    const code = parsed.data.couponCode?.trim();
    const quote = code
      ? await quoteCoupon({
          code,
          userId: user.id,
          plan: parsed.data.plan,
          cycle: parsed.data.cycle,
        })
      : quoteWithoutCoupon(parsed.data.plan, parsed.data.cycle);

    return {
      ok: true,
      data: {
        couponCode: quote.coupon?.code ?? null,
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.discountPaise,
        totalPaise: quote.totalPaise,
        currency: quote.currency,
        message: quote.message,
        freeAccessDays: quote.freeAccessDays,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Coupon check failed."),
    };
  }
}

export async function redeemFreeAccessCouponAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = StartCheckoutSchema.extend({
    couponCode: z.string().min(3).max(64),
  }).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid coupon redemption." };
  }
  try {
    await redeemFreeAccessCoupon({
      plan: parsed.data.plan,
      cycle: parsed.data.cycle,
      couponCode: parsed.data.couponCode,
    });
    revalidatePath("/dashboard/settings/billing");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Coupon redemption failed."),
    };
  }
}

const CancelSchema = z.object({ immediate: z.boolean().optional() });

export async function cancelSubscriptionAction(
  raw: unknown,
): Promise<ActionResult> {
  const parsed = CancelSchema.safeParse(raw ?? {});
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  try {
    await cancelCurrentSubscription({ immediate: parsed.data.immediate });
    revalidatePath("/dashboard/settings/billing");
    revalidatePath("/dashboard");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Cancellation failed."),
    };
  }
}

export async function reactivateSubscriptionAction(): Promise<
  | { ok: true; status: "kept" }
  | { ok: true; status: "needs_checkout"; checkout: CheckoutSession }
  | { ok: false; error: string }
> {
  try {
    const result = await reactivateCurrentSubscription();
    revalidatePath("/dashboard/settings/billing");
    if (result.status === "kept") return { ok: true, status: "kept" };
    return { ok: true, status: "needs_checkout", checkout: result.checkout };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Reactivation failed."),
    };
  }
}

export async function refreshSubscriptionAction(): Promise<ActionResult> {
  try {
    await refreshCurrentSubscription();
    revalidatePath("/dashboard/settings/billing");
    return { ok: true, data: undefined };
  } catch (err) {
    return {
      ok: false,
      error: billingErrorMessage(err, "Refresh failed."),
    };
  }
}
