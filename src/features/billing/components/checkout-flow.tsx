"use client";

import * as React from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  TicketPercent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/format";
import { PLANS } from "@/features/subscription/plans";
import { cn } from "@/lib/utils";
import {
  quoteCheckoutAction,
  redeemFreeAccessCouponAction,
  startCheckoutAction,
} from "../actions";
import type { BillingCycle, CheckoutSession } from "../types";

interface CheckoutFlowProps {
  plan: "pro" | "business";
  cycle: BillingCycle;
  initialQuote: {
    subtotalPaise: number;
    discountPaise: number;
    totalPaise: number;
    couponCode: string | null;
    freeAccessDays: number | null;
  };
  customer: {
    name: string;
    email: string;
    businessName: string | null;
    gstin: string | null;
  };
}

export function CheckoutFlow({
  plan,
  cycle,
  initialQuote,
  customer,
}: CheckoutFlowProps) {
  const router = useRouter();
  const [couponInput, setCouponInput] = React.useState(initialQuote.couponCode ?? "");
  const [appliedCoupon, setAppliedCoupon] = React.useState(initialQuote.couponCode);
  const [quote, setQuote] = React.useState(initialQuote);
  const [couponPending, startCouponTransition] = React.useTransition();
  const [paying, setPaying] = React.useState(false);

  const planDef = PLANS[plan];
  const period = cycle === "yearly" ? "year" : "month";
  const monthlyEquivalent =
    cycle === "yearly" ? Math.round(quote.totalPaise / 12 / 100) : null;

  const applyCoupon = React.useCallback(() => {
    startCouponTransition(async () => {
      const res = await quoteCheckoutAction({
        plan,
        cycle,
        couponCode: couponInput,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.data.message) {
        setAppliedCoupon(null);
        setQuote({
          subtotalPaise: res.data.subtotalPaise,
          discountPaise: 0,
          totalPaise: res.data.subtotalPaise,
          couponCode: null,
          freeAccessDays: null,
        });
        toast.error(res.data.message);
        return;
      }
      setAppliedCoupon(res.data.couponCode);
      setCouponInput(res.data.couponCode ?? "");
      setQuote({
        subtotalPaise: res.data.subtotalPaise,
        discountPaise: res.data.discountPaise,
        totalPaise: res.data.totalPaise,
        couponCode: res.data.couponCode,
        freeAccessDays: res.data.freeAccessDays,
      });
      toast.success("Coupon applied.");
    });
  }, [couponInput, cycle, plan]);

  const launch = React.useCallback(
    (session: CheckoutSession) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        if (session.shortUrl) {
          window.location.href = session.shortUrl;
          return;
        }
        toast.error("Checkout failed to load. Please refresh and try again.");
        setPaying(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: session.keyId,
        subscription_id: session.subscriptionId,
        name: "Stackivo",
        description: `${planDef.name} ${cycle === "yearly" ? "Yearly" : "Monthly"}`,
        prefill: session.prefill,
        notes: session.notes,
        theme: { color: "#2563eb" },
        handler: () => {
          toast.success("Payment received. Activating your plan...");
          setTimeout(() => router.push("/dashboard/settings/billing"), 1500);
        },
        modal: {
          ondismiss: () => setPaying(false),
        },
      });
      rzp.on("payment.failed", (payload) => {
        toast.error(getRazorpayErrorMessage(payload));
        setPaying(false);
      });
      rzp.open();
    },
    [cycle, planDef.name, router],
  );

  const pay = React.useCallback(async () => {
    setPaying(true);
    if (quote.freeAccessDays && appliedCoupon) {
      const res = await redeemFreeAccessCouponAction({
        plan,
        cycle,
        couponCode: appliedCoupon,
      });
      if (!res.ok) {
        setPaying(false);
        toast.error(res.error);
        return;
      }
      toast.success(`${planDef.name} activated for ${quote.freeAccessDays} days.`);
      router.push("/dashboard/settings/billing");
      return;
    }

    const res = await startCheckoutAction({
      plan,
      cycle,
      couponCode: appliedCoupon,
    });
    if (!res.ok) {
      setPaying(false);
      toast.error(res.error);
      return;
    }
    launch(res.data);
  }, [appliedCoupon, cycle, launch, plan, planDef.name, quote.freeAccessDays, router]);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="min-h-[calc(100vh-4rem)] bg-muted/25 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to billing
          </Link>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="overflow-hidden rounded-2xl border bg-background shadow-sm">
              <div className="border-b bg-gradient-to-br from-primary/[0.08] via-background to-background px-6 py-7">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
                  <Sparkles className="h-4 w-4" />
                  Stackivo checkout
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  Upgrade to {planDef.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Review your plan, billing details, and discount before moving to
                  Razorpay for secure payment authorization.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <InfoBlock title="Plan" value={planDef.name} detail={planDef.description} />
                <InfoBlock
                  title="Billing cycle"
                  value={cycle === "yearly" ? "Yearly" : "Monthly"}
                  detail={
                    cycle === "yearly"
                      ? "Two months effectively included in the annual price."
                      : "Renews monthly until cancelled."
                  }
                />
                <InfoBlock
                  title="Billing identity"
                  value={customer.businessName ?? customer.name}
                  detail={customer.email}
                />
                <InfoBlock
                  title="Tax details"
                  value="INR subscription"
                  detail={customer.gstin ? `GSTIN ${customer.gstin}` : "GST invoice details can be updated in billing settings."}
                />
              </div>

              <div className="border-t p-6">
                <h2 className="text-sm font-semibold">What unlocks immediately</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {planPerks(plan).map((perk) => (
                    <div key={perk} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="h-fit rounded-2xl border bg-background p-5 shadow-sm lg:sticky lg:top-24">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Order summary</h2>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                  {cycle}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <SummaryRow label={`${planDef.name} plan`} value={formatINR(quote.subtotalPaise / 100)} />
                {quote.discountPaise > 0 ? (
                  <SummaryRow
                    label={`Coupon ${appliedCoupon}`}
                    value={`-${formatINR(quote.discountPaise / 100)}`}
                    good
                  />
                ) : null}
                <div className="border-t pt-3">
                  <SummaryRow
                    label={`Due now, then every ${period}`}
                    value={formatINR(quote.totalPaise / 100)}
                    strong
                  />
                  {monthlyEquivalent !== null ? (
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      {formatINR(monthlyEquivalent)}/month equivalent
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-lg border bg-muted/25 p-3">
                <label className="text-xs font-medium text-muted-foreground">
                  Coupon code
                </label>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={couponInput}
                    onChange={(event) => setCouponInput(event.target.value.toUpperCase())}
                    placeholder="LAUNCH30"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={couponPending || paying || couponInput.trim().length < 3}
                    onClick={applyCoupon}
                  >
                    {couponPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
                {appliedCoupon ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-success-strong">
                    <TicketPercent className="h-3.5 w-3.5" />
                    {appliedCoupon} is applied
                    {quote.freeAccessDays
                      ? `: ${quote.freeAccessDays} days of ${planDef.name} access.`
                      : " to this checkout."}
                  </p>
                ) : null}
              </div>

              <div className="mt-5 space-y-3 rounded-lg border border-primary/15 bg-primary/[0.03] p-3 text-xs leading-5 text-muted-foreground">
                <p className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Payments are secured by Razorpay. Stackivo never sees or stores card, UPI, or bank details.
                </p>
                <p className="flex gap-2">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Cancel anytime from Settings. Access remains until the end of your paid period.
                </p>
              </div>

              <Button type="button" className="mt-5 w-full" size="lg" disabled={paying} onClick={pay}>
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {quote.freeAccessDays ? "Activating plan" : "Opening secure payment"}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {quote.freeAccessDays
                      ? `Activate ${planDef.name}`
                      : `Pay ${formatINR(quote.totalPaise / 100)}`}
                  </>
                )}
              </Button>

              <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
                By continuing, you agree to Stackivo&apos;s{" "}
                <PolicyLink href="/terms">Terms</PolicyLink>,{" "}
                <PolicyLink href="/refund-policy">Refund policy</PolicyLink>, and{" "}
                <PolicyLink href="/privacy">Privacy policy</PolicyLink>.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoBlock({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-card/50 p-4">
      <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong,
  good,
}: {
  label: string;
  value: string;
  strong?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-sm text-muted-foreground", strong && "text-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-medium tabular-nums",
          strong && "text-xl font-semibold",
          good && "text-success-strong",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} target="_blank" className="font-medium text-primary hover:underline">
      {children}
    </Link>
  );
}

function getRazorpayErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Payment failed.";
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return "Payment failed.";
  const description = (error as { description?: unknown }).description;
  const reason = (error as { reason?: unknown }).reason;
  return (
    (typeof description === "string" && description) ||
    (typeof reason === "string" && reason) ||
    "Payment failed."
  );
}

function planPerks(plan: "pro" | "business"): string[] {
  const pro = [
    "Unlimited clients, projects, and invoices",
    "Custom invoice branding and watermark removal",
    "Client portals for shared workspace delivery",
    "Contracts with e-signature workflows",
    "Time tracking, billable rates, and reports",
    "Advanced Pulse reports and GST-ready insights",
  ];
  if (plan === "pro") return pro;
  return [
    ...pro,
    "API access and collaborator-ready operations",
    "Priority support for billing and workspace issues",
  ];
}
