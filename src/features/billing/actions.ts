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
  startCheckout,
} from "./server";
import { RazorpayApiError } from "./razorpay/client";
import type { CheckoutSession } from "./types";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const StartCheckoutSchema = z.object({
  plan: z.enum(["pro", "business"]),
  cycle: z.enum(["monthly", "yearly"]),
});

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
