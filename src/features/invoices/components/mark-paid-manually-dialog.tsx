"use client";

/**
 * Freelancer-facing offline payment recorder.
 *
 * Renders as a centered dialog on desktop and a bottom sheet on mobile (via
 * ResponsiveModal). Submitting fires markInvoicePaidManuallyAction which
 * inserts audit + ledger rows, generates the receipt, updates the invoice
 * balance/status, and emails the client the receipt.
 */

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { BadgeCheck } from "lucide-react";
import {
  markInvoicePaidManuallyAction,
  type ManualPaymentResult,
} from "../manual-payment-actions";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  amountLabel: string;
  defaultAmount: number;
  currency: string;
  /** When already paid we render the trigger disabled with a different label. */
  alreadyPaid: boolean;
}

export function MarkPaidManuallyDialog({
  invoiceId,
  invoiceNumber,
  amountLabel,
  defaultAmount,
  currency,
  alreadyPaid,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = useActionState<
    ManualPaymentResult | undefined,
    FormData
  >(markInvoicePaidManuallyAction, undefined);

  // Close once we've successfully marked it paid, leaving the success state
  // visible briefly.
  React.useEffect(() => {
    if (state?.ok && !state.alreadyPaid) {
      const t = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <>
      <Button
        variant={alreadyPaid ? "outline" : "default"}
        size="sm"
        disabled={alreadyPaid}
        onClick={() => setOpen(true)}
      >
        <BadgeCheck className="h-4 w-4" />
        {alreadyPaid ? "Paid" : "Record payment"}
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-[440px]"
        title={`Record payment for ${invoiceNumber}`}
        description="Record UPI, bank, Wise, PayPal, or other payments received outside Stackivo. Partial payments are supported."
      >
        <form action={action} className="space-y-4 pb-2">
          <input type="hidden" name="invoiceId" value={invoiceId} />

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Balance: </span>
            <span className="font-semibold">{amountLabel}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-method">Method</Label>
              <select
                id="mp-method"
                name="method"
                defaultValue="upi"
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
              >
                <option value="upi">UPI</option>
                <option value="bank">Bank transfer</option>
                <option value="wire">Wire transfer</option>
                <option value="wise">Wise</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-amount">Amount in invoice currency</Label>
              <Input
                id="mp-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={defaultAmount}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_110px]">
            <div className="space-y-1.5">
              <Label htmlFor="mp-received-amount">Amount actually received</Label>
              <Input
                id="mp-received-amount"
                name="receivedAmount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={defaultAmount}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-received-currency">Currency</Label>
              <Input
                id="mp-received-currency"
                name="receivedCurrency"
                maxLength={3}
                defaultValue={currency}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-reference">
              Transaction reference{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mp-reference"
              name="reference"
              placeholder="UTR / txn id from your bank app"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Helps your client&apos;s accountant match the payment. Shown on the
              receipt.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-proof">
              Proof link <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mp-proof"
              name="proofUrl"
              type="url"
              placeholder="https://drive.google.com/..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="mp-notes"
              name="notes"
              rows={2}
              placeholder="Any context for your records"
            />
          </div>

          {state && state.ok && !state.alreadyPaid ? (
            <p className="rounded-lg bg-success-subtle p-2.5 text-xs text-success-strong">
              Payment recorded. Receipt {state.receiptNumber} generated.
              {state.status === "partially_paid" ? " Invoice is partially paid." : ""}
            </p>
          ) : null}
          {state && !state.ok ? (
            <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton />
          </div>
        </form>
      </ResponsiveModal>
    </>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Recording..." : "Record payment"}
    </Button>
  );
}
