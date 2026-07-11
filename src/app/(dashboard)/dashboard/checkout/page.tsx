import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getProfile } from "@/features/profile/server";
import { CheckoutFlow } from "@/features/billing/components/checkout-flow";
import { quoteCoupon, quoteWithoutCoupon } from "@/features/billing/coupons";
import type { BillingCycle } from "@/features/billing/types";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const plan = asString(params.plan) === "business" ? "business" : "pro";
  const cycle: BillingCycle = asString(params.cycle) === "yearly" ? "yearly" : "monthly";
  const couponCode = asString(params.coupon);

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const profile = await getProfile();
  const quote = couponCode
    ? await quoteCoupon({ code: couponCode, userId: user.id, plan, cycle })
    : quoteWithoutCoupon(plan, cycle);

  return (
    <CheckoutFlow
      plan={plan}
      cycle={cycle}
      initialQuote={{
        subtotalPaise: quote.subtotalPaise,
        discountPaise: quote.message ? 0 : quote.discountPaise,
        totalPaise: quote.message ? quote.subtotalPaise : quote.totalPaise,
        couponCode: quote.message ? null : quote.coupon?.code ?? null,
        freeAccessDays: quote.message ? null : quote.freeAccessDays,
      }}
      customer={{
        name: profile?.fullName ?? user.email ?? "Stackivo customer",
        email: profile?.businessEmail ?? profile?.email ?? user.email ?? "",
        businessName: profile?.businessName ?? profile?.legalName ?? null,
        gstin: profile?.gstin ?? null,
      }}
    />
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
