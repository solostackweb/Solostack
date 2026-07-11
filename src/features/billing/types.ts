/**
 * Public types for the billing domain.
 *
 * These are safe to import from both server and client modules. Server-only
 * helpers live in `./server.ts` and `./razorpay/*`.
 */

import type {
  BillingCycle,
  BillingPaymentRow,
  SubscriptionPlanRow,
  SubscriptionStatusRow,
} from "@/lib/supabase/types";

export type { BillingCycle };

/** Snapshot of the user's billing state, hydrated from `subscriptions`. */
export interface BillingSubscription {
  id: string;
  userId: string;
  plan: SubscriptionPlanRow;
  status: SubscriptionStatusRow;
  billingCycle: BillingCycle;
  razorpaySubscriptionId: string | null;
  razorpayCustomerId: string | null;
  razorpayPlanId: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  lastPaymentAt: string | null;
  nextChargeAt: string | null;
  gracePeriodEndsAt: string | null;
  couponId: string | null;
  couponCode: string | null;
  couponDiscountAmount: number;
  checkoutAmount: number | null;
  checkoutCurrency: string;
}

/** Display-ready row in the billing-history table. */
export interface BillingPayment {
  id: string;
  paymentId: string;
  invoiceId: string | null;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
  cardLast4: string | null;
  description: string | null;
  capturedAt: string | null;
  receiptUrl: string | null;
  errorDescription: string | null;
  createdAt: string;
}

export function mapPaymentRow(row: BillingPaymentRow): BillingPayment {
  return {
    id: row.id,
    paymentId: row.razorpay_payment_id,
    invoiceId: row.razorpay_invoice_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    method: row.method,
    cardLast4: row.card_last4,
    description: row.description,
    capturedAt: row.captured_at,
    receiptUrl: row.receipt_url,
    errorDescription: row.error_description,
    createdAt: row.created_at,
  };
}

/**
 * Returned by `startCheckout` — everything the browser needs to launch the
 * Razorpay Checkout for a subscription.
 */
export interface CheckoutSession {
  subscriptionId: string;        // Razorpay subscription id (sub_xxx)
  shortUrl: string | null;        // Hosted Razorpay subscription page (fallback)
  keyId: string;                  // Public key id used by Checkout JS
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes: Record<string, string>;
  amountPaise: number;
  subtotalPaise: number;
  discountPaise: number;
  currency: "INR";
  couponCode: string | null;
}

/** Inputs for starting a new subscription checkout. */
export interface StartCheckoutInput {
  plan: Exclude<SubscriptionPlanRow, "free">;
  cycle: BillingCycle;
  couponCode?: string | null;
}

/** Compact lifecycle summary used by middleware-aware UI bits. */
export interface BillingLifecycle {
  isActive: boolean;
  isPastDue: boolean;
  isCanceledAtPeriodEnd: boolean;
  isInGracePeriod: boolean;
  daysUntilRenewal: number | null;
  daysUntilGraceEnds: number | null;
}
