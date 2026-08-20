"use client";

import * as React from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { CreditCard, ShieldCheck, Loader2 } from "lucide-react";
import {
  createInvoicePaymentOrderAction,
  verifyInvoicePaymentAction,
} from "../public-payment-actions";

interface Props {
  token: string;
  amountFormatted: string;
  invoiceNumber: string;
  alreadyPaid: boolean;
  freelancerName: string;
  /** Optional pre-filled identity for the Razorpay modal. */
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

/**
 * Razorpay checkout panel rendered on the public invoice page.
 *
 * Flow:
 *   1. Lazy-load Razorpay's checkout.js (Razorpay ships a single script
 *      tag served from their CDN).
 *   2. On click, call our `createInvoicePaymentOrderAction(token)` to
 *      mint an order under the freelancer's account.
 *   3. Open the Razorpay modal with the resulting `order_id` + `keyId`.
 *   4. On success, refresh the page — the webhook will have flipped the
 *      invoice to `paid` by the time the freelancer's dashboard is next
 *      viewed; the client just sees "Paid" + a success state.
 */
export function PublicPaymentPanel({
  token,
  amountFormatted,
  invoiceNumber,
  alreadyPaid,
  freelancerName,
  prefill,
}: Props) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [scriptReady, setScriptReady] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  if (alreadyPaid) {
    return (
      <div className="rounded-lg border border-success-subtle bg-success-subtle p-5 text-center">
        <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-success-strong" />
        <p className="text-sm font-semibold text-success-strong">
          This invoice has been paid.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Thank you! A receipt has been emailed to you.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-lg border border-success-subtle bg-success-subtle p-5 text-center">
        <ShieldCheck className="mx-auto mb-2 h-7 w-7 text-success-strong" />
        <p className="text-sm font-semibold text-success-strong">
          Payment received — thank you!
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A receipt is on its way to your inbox. You can close this page.
        </p>
      </div>
    );
  }

  async function onPay() {
    setError(null);
    setPending(true);
    try {
      if (!window.Razorpay) {
        setError("Payment SDK still loading — try again in a moment.");
        return;
      }
      const order = await createInvoicePaymentOrderAction(token);
      if (!order.ok) {
        setError(order.error);
        return;
      }
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        name: freelancerName,
        description: `Invoice ${order.invoiceNumber}`,
        order_id: order.orderId,
        prefill: prefill ?? {},
        theme: { color: "#2563EB" },
        modal: {
          ondismiss: () => setPending(false),
        },
        handler: async (resp) => {
          // Razorpay returns a signed proof of payment. We verify it
          // server-side using the freelancer's secret, mark the invoice
          // paid, and trigger the receipt email — all before showing the
          // client the success state, so a tampered payload can never
          // produce a false "paid" UI.
          setPending(true);
          const orderId = resp.razorpay_order_id ?? "";
          const paymentId = resp.razorpay_payment_id ?? "";
          const signature = resp.razorpay_signature ?? "";
          if (!orderId || !paymentId || !signature) {
            setError("Incomplete payment response from Razorpay.");
            setPending(false);
            return;
          }
          const verify = await verifyInvoicePaymentAction({
            token,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentId,
            razorpaySignature: signature,
          });
          if (verify.ok) {
            setSuccess(true);
          } else {
            setError(verify.error);
            setPending(false);
          }
        },
      });
      rzp.on("payment.failed", (resp: unknown) => {
        const obj = resp as {
          error?: { description?: string };
        } | null;
        setError(
          obj?.error?.description ?? "Payment failed. Please try again.",
        );
        setPending(false);
      });
      rzp.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong starting the payment.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
        onLoad={() => setScriptReady(true)}
      />
      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pay invoice {invoiceNumber}
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            {amountFormatted}
          </p>
          <p className="text-xs text-muted-foreground">
            Secure payment via Razorpay. Cards, UPI, netbanking, wallets.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={onPay}
          disabled={pending || !scriptReady}
        >
          {pending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening
              checkout…
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" /> Pay now
            </>
          )}
        </Button>
        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </p>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Stackivo never sees your card details. Razorpay is PCI-DSS L1.
        </p>
      </div>
    </>
  );
}
