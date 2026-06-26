"use client";

/**
 * Subscription-detail actions: cancel + manual refund.
 *
 * Comp is reached through the user detail page (it can also create
 * subscriptions, so its home is on the user). Refund here references
 * a specific payment row by id.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreditCard, XCircle } from "lucide-react";

import {
  adminCancelSubscriptionAction,
  adminRecordRefundAction,
  type AdminActionResult,
} from "@/features/admin/actions";
import { TypedConfirmButton } from "./typed-confirm-button";

interface Props {
  subscription: {
    id: string;
    user_id: string;
    email: string;
    status: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    razorpay_payment_id: string;
    created_at: string;
  }>;
}

export function SubscriptionActions({ subscription, payments }: Props) {
  const router = useRouter();

  const announce = React.useCallback(
    (res: AdminActionResult<unknown>) => {
      if (res.ok) {
        toast.success(res.message ?? "Done");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    },
    [router],
  );

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Actions
      </h2>

      <div className="space-y-3 rounded-xl border bg-card shadow-sm shadow-black/[0.03] p-3 text-xs">
        {/* Cancel */}
        <CancelForm
          subscriptionId={subscription.id}
          email={subscription.email}
          announce={announce}
          disabled={subscription.status === "canceled"}
        />

        {/* Record refund */}
        <RefundForm
          userId={subscription.user_id}
          email={subscription.email}
          payments={payments}
          announce={announce}
        />
      </div>
    </section>
  );
}

function CancelForm({
  subscriptionId,
  email,
  announce,
  disabled,
}: {
  subscriptionId: string;
  email: string;
  announce: (r: AdminActionResult<unknown>) => void;
  disabled: boolean;
}) {
  const [immediately, setImmediately] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <form
      action={async () => {
        const res = await adminCancelSubscriptionAction({
          subscriptionId,
          immediately,
          reason: reason.trim() || undefined,
        });
        announce(res);
      }}
      className="space-y-2"
    >
      <div className="flex items-start gap-2">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-medium">Cancel subscription</div>
          <div className="text-[11px] text-muted-foreground">
            {immediately
              ? "Status flips to canceled now."
              : "Continues until period end, then cancels."}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-1.5 text-[11px]">
        <input
          type="checkbox"
          checked={immediately}
          onChange={(e) => setImmediately(e.target.checked)}
        />
        Cancel immediately (no period grace)
      </label>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="h-7 w-full rounded border bg-background px-2"
      />
      <TypedConfirmButton
        label={immediately ? "Cancel now" : "Cancel at period end"}
        confirmText={email}
        tier="sensitive"
        variant="destructive"
        disabled={disabled}
      />
    </form>
  );
}

function RefundForm({
  userId,
  email,
  payments,
  announce,
}: {
  userId: string;
  email: string;
  payments: Props["payments"];
  announce: (r: AdminActionResult<unknown>) => void;
}) {
  const refundable = payments.filter((p) => p.status === "captured");
  const [paymentId, setPaymentId] = React.useState<string>(
    refundable[0]?.id ?? "",
  );
  const [amountInr, setAmountInr] = React.useState<string>("");
  const [refundId, setRefundId] = React.useState("");
  const [reason, setReason] = React.useState("");

  const selected = refundable.find((p) => p.id === paymentId);

  return (
    <form
      action={async () => {
        if (!paymentId) {
          announce({ ok: false, error: "Pick a payment first." });
          return;
        }
        const amountPaise = amountInr.trim()
          ? Math.round(parseFloat(amountInr) * 100)
          : undefined;
        const res = await adminRecordRefundAction({
          userId,
          paymentId,
          amountPaise,
          razorpayRefundId: refundId.trim() || undefined,
          reason: reason.trim() || undefined,
        });
        announce(res);
      }}
      className="space-y-2 border-t border-border/40 pt-3"
    >
      <div className="flex items-start gap-2">
        <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-medium">Record manual refund</div>
          <div className="text-[11px] text-muted-foreground">
            This does <em>not</em> call Razorpay — issue the refund in their
            dashboard first, then log it here so MRR math stays correct.
          </div>
        </div>
      </div>
      {refundable.length === 0 ? (
        <div className="rounded border border-dashed bg-muted/20 px-2 py-2 text-[11px] text-muted-foreground">
          No captured payments available to refund.
        </div>
      ) : (
        <>
          <select
            value={paymentId}
            onChange={(e) => setPaymentId(e.target.value)}
            className="h-7 w-full rounded border bg-background px-2"
          >
            {refundable.map((p) => (
              <option key={p.id} value={p.id}>
                ₹{(p.amount / 100).toLocaleString("en-IN")} · {p.razorpay_payment_id} ·{" "}
                {new Date(p.created_at).toLocaleDateString("en-IN")}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              placeholder={
                selected
                  ? `Default ₹${(selected.amount / 100).toLocaleString("en-IN")}`
                  : "INR"
              }
              className="h-7 w-32 rounded border bg-background px-2"
            />
            <input
              type="text"
              value={refundId}
              onChange={(e) => setRefundId(e.target.value)}
              placeholder="Razorpay refund id (optional)"
              className="h-7 flex-1 rounded border bg-background px-2"
            />
          </div>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="h-7 w-full rounded border bg-background px-2"
          />
          <TypedConfirmButton
            label="Record refund"
            confirmText={email}
            tier="sensitive"
          />
        </>
      )}
    </form>
  );
}
