"use client";

/**
 * TEST-ONLY subscribe button. Renders only when
 * NEXT_PUBLIC_ENABLE_TEST_CHECKOUT === "1". Subscribes to the low-value test
 * plan (RAZORPAY_PLAN_TEST_MONTHLY) to verify LIVE recurring authorisation
 * without paying the full plan price. Does not change the user's real plan.
 */

import * as React from "react";
import Script from "next/script";
import { toast } from "sonner";
import { Loader2, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { startTestCheckoutAction } from "../actions";
import type { CheckoutSession } from "../types";

export function TestCheckoutButton() {
  const [loading, setLoading] = React.useState(false);

  if (process.env.NEXT_PUBLIC_ENABLE_TEST_CHECKOUT !== "1") return null;

  const launch = (session: CheckoutSession) => {
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
      name: "Stackivo (test)",
      description: "Test subscription — live recurring check",
      prefill: session.prefill,
      notes: session.notes,
      theme: { color: "#2563eb" },
      handler: () => {
        toast.success("Test mandate authorised — live recurring works.");
        setLoading(false);
      },
      modal: { ondismiss: () => setLoading(false) },
    });
    rzp.on("payment.failed", (payload: unknown) => {
      const desc =
        (payload as { error?: { description?: string } })?.error?.description ??
        "Payment failed.";
      toast.error(desc);
      setLoading(false);
    });
    rzp.open();
  };

  const onClick = async () => {
    setLoading(true);
    const res = await startTestCheckoutAction();
    if (!res.ok) {
      setLoading(false);
      toast.error(res.error);
      return;
    }
    launch(res.data);
  };

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <p className="mb-2 text-xs font-medium text-amber-700 dark:text-amber-400">
        Test mode — live recurring check (₹10/mo plan)
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
        {loading ? "Opening…" : "Test subscribe (₹10/mo)"}
      </Button>
    </div>
  );
}
