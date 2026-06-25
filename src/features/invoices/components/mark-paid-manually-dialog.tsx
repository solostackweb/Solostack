"use client";

/**
 * Freelancer-facing "Mark this invoice paid (UPI / bank transfer)".
 *
 * Renders as a centered dialog on desktop and a bottom sheet on mobile (via
 * ResponsiveModal). Submitting fires markInvoicePaidManuallyAction which
 * inserts a manual_confirmations audit row, generates the receipt, flips the
 * invoice to paid, and emails the client the receipt.
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
  /** When already paid we render the trigger disabled with a different label. */
  alreadyPaid: boolean;
}

export function MarkPaidManuallyDialog({
  invoiceId,
  invoiceNumber,
  amountLabel,
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
        {alreadyPaid ? "Paid" : "Mark as paid"}
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        className="sm:max-w-[440px]"
        title={`Mark invoice ${invoiceNumber} paid`}
        description="Use this for UPI / bank transfers received outside Stackivo. We generate the receipt and email it to the client."
      >
        <form action={action} className="space-y-4 pb-2">
          <input type="hidden" name="invoiceId" value={invoiceId} />

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Amount: </span>
            <span className="font-semibold">{amountLabel}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mp-reference">
              UPI / transaction reference{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mp-reference"
              name="reference"
              placeholder="UTR / txn id from your bank app"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Helps your client&apos;s accountant match the payment. Shown on the
              receipt.
            </p>
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
            <p className="rounded-md bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-400">
              Marked paid. Receipt {state.receiptNumber} generated.
            </p>
          ) : null}
          {state && !state.ok ? (
            <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive">
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
      {pending ? "Recording…" : "Mark as paid"}
    </Button>
  );
}
