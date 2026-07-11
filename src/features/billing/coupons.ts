import "server-only";

import { getAdminSupabase } from "@/lib/supabase/admin";
import { PLANS } from "@/features/subscription/plans";
import type {
  BillingCouponRow,
  BillingCycle,
  SubscriptionPlanRow,
} from "@/lib/supabase/types";
import { createPlan, fetchPlan } from "./razorpay/client";

export interface CouponQuote {
  coupon: BillingCouponRow | null;
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  currency: "INR";
  message: string | null;
  freeAccessDays: number | null;
}

export interface ValidCouponQuote extends CouponQuote {
  coupon: BillingCouponRow;
}

export function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function planPricePaise(
  plan: Exclude<SubscriptionPlanRow, "free">,
  cycle: BillingCycle,
): number {
  const def = PLANS[plan];
  return cycle === "yearly"
    ? def.priceYearlyPaise ?? 0
    : def.priceMonthlyPaise ?? 0;
}

export function quoteWithoutCoupon(
  plan: Exclude<SubscriptionPlanRow, "free">,
  cycle: BillingCycle,
): CouponQuote {
  const subtotal = planPricePaise(plan, cycle);
  return {
    coupon: null,
    subtotalPaise: subtotal,
    discountPaise: 0,
    totalPaise: subtotal,
    currency: "INR",
    message: null,
    freeAccessDays: null,
  };
}

export async function quoteCoupon(input: {
  code: string;
  userId: string;
  plan: Exclude<SubscriptionPlanRow, "free">;
  cycle: BillingCycle;
}): Promise<CouponQuote> {
  const subtotal = planPricePaise(input.plan, input.cycle);
  const code = normaliseCouponCode(input.code);
  if (!code) {
    return {
      coupon: null,
      subtotalPaise: subtotal,
      discountPaise: 0,
      totalPaise: subtotal,
      currency: "INR",
      message: "Enter a coupon code.",
      freeAccessDays: null,
    };
  }

  const admin = getAdminSupabase();
  const { data, error } = await admin
    .from("billing_coupons")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const coupon = data as unknown as BillingCouponRow | null;
  if (!coupon) return invalidQuote(subtotal, "Coupon code not found.");

  const now = Date.now();
  if (!coupon.active) return invalidQuote(subtotal, "This coupon is inactive.");
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return invalidQuote(subtotal, "This coupon is not active yet.");
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() <= now) {
    return invalidQuote(subtotal, "This coupon has expired.");
  }
  if (coupon.applies_to_plan !== "all" && coupon.applies_to_plan !== input.plan) {
    return invalidQuote(subtotal, "This coupon is not valid for this plan.");
  }
  if (coupon.applies_to_cycle !== "all" && coupon.applies_to_cycle !== input.cycle) {
    return invalidQuote(subtotal, "This coupon is not valid for this billing cycle.");
  }
  if (coupon.max_redemptions !== null && coupon.redeem_count >= coupon.max_redemptions) {
    return invalidQuote(subtotal, "This coupon has reached its redemption limit.");
  }

  const { count, error: countError } = await admin
    .from("billing_coupon_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("coupon_id", coupon.id)
    .eq("user_id", input.userId)
    .in("status", ["created", "applied", "paid"]);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= coupon.max_redemptions_per_user) {
    return invalidQuote(subtotal, "This coupon was already used on this account.");
  }

  const discount =
    coupon.grant_type === "free_access"
      ? subtotal
      : coupon.discount_type === "percent"
        ? Math.floor((subtotal * coupon.discount_value) / 100)
        : coupon.discount_value;
  const discountPaise = Math.min(subtotal, Math.max(0, discount));

  return {
    coupon,
    subtotalPaise: subtotal,
    discountPaise,
    totalPaise: subtotal - discountPaise,
    currency: "INR",
    message: null,
    freeAccessDays: coupon.grant_type === "free_access"
      ? coupon.grant_duration_days ?? 365
      : null,
  };
}

export function assertValidCouponQuote(quote: CouponQuote): ValidCouponQuote {
  if (!quote.coupon || quote.message) {
    throw new Error(quote.message ?? "Invalid coupon.");
  }
  if (quote.coupon.grant_type !== "free_access" && quote.totalPaise < 100) {
    throw new Error("Coupon discount is too high for subscription checkout.");
  }
  return quote as ValidCouponQuote;
}

export async function ensureCheckoutPlan(input: {
  basePlan: Exclude<SubscriptionPlanRow, "free">;
  cycle: BillingCycle;
  amountPaise: number;
  coupon?: BillingCouponRow | null;
}): Promise<string> {
  if (!input.coupon || input.amountPaise === planPricePaise(input.basePlan, input.cycle)) {
    const { getRazorpayPlanId } = await import("./razorpay/plan-mapping");
    return getRazorpayPlanId(input.basePlan, input.cycle);
  }

  const admin = getAdminSupabase();
  const metadata = couponMetadata(input.coupon);
  const key = `${input.basePlan}:${input.cycle}:${input.amountPaise}`;
  const existing = metadata.razorpayPlans[key];
  if (typeof existing === "string" && existing) {
    try {
      await fetchPlan(existing);
      return existing;
    } catch {
      // Stale plan id; create a fresh one and overwrite metadata below.
    }
  }

  const plan = await createPlan({
    name: `Stackivo ${PLANS[input.basePlan].name} - ${input.coupon.code}`,
    amountPaise: input.amountPaise,
    period: input.cycle,
    description: `${input.coupon.code} discounted ${PLANS[input.basePlan].name} ${input.cycle}`,
    notes: {
      stackivo_plan: input.basePlan,
      billing_cycle: input.cycle,
      coupon_id: input.coupon.id,
      coupon_code: input.coupon.code,
    },
  });

  await admin
    .from("billing_coupons")
    .update({
      metadata: {
        ...metadata.raw,
        razorpay_plans: {
          ...metadata.razorpayPlans,
          [key]: plan.id,
        },
      },
    } as never)
    .eq("id", input.coupon.id);

  return plan.id;
}

function invalidQuote(subtotalPaise: number, message: string): CouponQuote {
  return {
    coupon: null,
    subtotalPaise,
    discountPaise: 0,
    totalPaise: subtotalPaise,
    currency: "INR",
    message,
    freeAccessDays: null,
  };
}

function couponMetadata(coupon: BillingCouponRow): {
  raw: Record<string, unknown>;
  razorpayPlans: Record<string, unknown>;
} {
  const raw =
    coupon.metadata && typeof coupon.metadata === "object" && !Array.isArray(coupon.metadata)
      ? (coupon.metadata as Record<string, unknown>)
      : {};
  const plans =
    raw.razorpay_plans && typeof raw.razorpay_plans === "object" && !Array.isArray(raw.razorpay_plans)
      ? (raw.razorpay_plans as Record<string, unknown>)
      : {};
  return { raw, razorpayPlans: plans };
}
