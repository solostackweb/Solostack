"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/format";
import { PLANS } from "@/features/subscription/plans";
import { startCheckoutAction } from "../actions";
import type { BillingCycle, CheckoutSession } from "../types";

interface CheckoutButtonProps {
  plan: "pro" | "business";
  cycle: BillingCycle;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  disabled?: boolean;
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

/**
 * Upgrade flow: branded pre-checkout summary (price + autopay mandate
 * consent + policy links) -> Razorpay popup (SDK preloaded to avoid the
 * white-flash). Webhook is the source of truth for unlocking.
 */
export function CheckoutButton({
  plan,
  cycle,
  label,
  variant = "default",
  size = "default",
  className,
  disabled,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const planDef = PLANS[plan];
  const planName = planDef.name;
  const pricePaise =
    cycle === "yearly" ? planDef.priceYearlyPaise : planDef.priceMonthlyPaise;
  const priceRupees = pricePaise / 100;
  const perLabel = cycle === "yearly" ? "year" : "month";
  const monthlyEquivalent =
    cycle === "yearly" ? Math.round(planDef.priceYearlyPaise / 12 / 100) : null;

  const launch = React.useCallback(
    (session: CheckoutSession) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        if (session.shortUrl) {
          window.location.href = session.shortUrl;
          return;
        }
        toast.error("Checkout failed to load. Please refresh and try again.");
        setLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: session.keyId,
        subscription_id: session.subscriptionId,
        name: "Stackivo",
        description: `${planName} · ${cycle === "yearly" ? "Yearly" : "Monthly"}`,
        prefill: session.prefill,
        notes: session.notes,
        theme: { color: "#2563eb" },
        handler: () => {
          toast.success("Payment received. Activating your plan…");
          setTimeout(() => router.refresh(), 1500);
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.on("payment.failed", (payload) => {
        toast.error(getRazorpayErrorMessage(payload));
        setLoading(false);
      });
      rzp.open();
    },
    [planName, cycle, router],
  );

  const onProceed = React.useCallback(async () => {
    setLoading(true);
    const result = await startCheckoutAction({ plan, cycle });
    if (!result.ok) {
      setLoading(false);
      toast.error(result.error);
      return;
    }
    setOpen(false);
    launch(result.data);
  }, [plan, cycle, launch]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || loading}
        onClick={() => setOpen(true)}
      >
        {label ?? `Upgrade to ${planName}`}
      </Button>

      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade to {planName}</DialogTitle>
            <DialogDescription>{planDef.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end justify-between rounded-lg border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cycle === "yearly" ? "Billed yearly" : "Billed monthly"}
                </p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums">
                  {formatINR(priceRupees)}
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {perLabel}
                  </span>
                </p>
              </div>
              {monthlyEquivalent !== null ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ≈ {formatINR(monthlyEquivalent)}/mo · 2 months free
                </span>
              ) : null}
            </div>

            <div className="flex gap-2.5 rounded-lg border border-primary/15 bg-primary/[0.03] px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1.5">
                <p>
                  By continuing, you authorise Stackivo to auto-debit{" "}
                  <span className="font-semibold text-foreground">
                    {formatINR(priceRupees)}
                  </span>{" "}
                  every {perLabel} until you cancel. You can{" "}
                  <span className="font-medium text-foreground">cancel anytime</span>{" "}
                  from Settings → Billing, and we&rsquo;ll remind you before each charge.
                </p>
                <p>
                  Prices in INR; taxes as applicable. Payments are secured by Razorpay
                  &mdash; Stackivo never sees your card details.
                </p>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                  <PolicyLink href="/terms">Terms</PolicyLink>
                  <PolicyLink href="/refund-policy">Refund &amp; cancellation</PolicyLink>
                  <PolicyLink href="/privacy">Privacy</PolicyLink>
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Not now
            </Button>
            <Button type="button" onClick={onProceed} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Opening…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" /> Proceed to secure payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary hover:underline"
    >
      {children}
    </Link>
  );
}
