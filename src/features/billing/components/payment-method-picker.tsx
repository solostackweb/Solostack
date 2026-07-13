"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationLogo } from "@/components/integrations/integration-logo";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { SettingsSection } from "@/features/settings/components/settings-section";
import {
  clearPaymentMethodAction,
  setUpiManualMethodAction,
  type ActionResult,
} from "../actions-payment-methods";
import type { PaymentMethodSummary } from "../payment-methods";

interface Props {
  summary: PaymentMethodSummary;
  initialUpiVpa: string | null;
}

export function PaymentMethodPicker({ summary, initialUpiVpa }: Props) {
  return (
    <SettingsSection
      title="Indian payments"
      description="For Indian clients, invoices show your UPI QR and UPI ID. Money goes directly to your account; you mark the invoice paid after receiving it."
    >
      <div className="space-y-4">
        {summary.type ? <ActiveBanner summary={summary} /> : null}

        {summary.type === "stackivo_managed" || summary.type === "upi_smart" ? (
          <RetiredMethodNotice />
        ) : (
          <div className="rounded-xl border bg-card">
            <div className="flex items-start gap-3 border-b px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                <IntegrationLogo id="upi" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">UPI Direct</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Best for domestic invoices. Free, simple, and familiar for Indian clients.
                </p>
              </div>
            </div>
            <div className="px-5 py-5">
              <UpiForm
                initialVpa={initialUpiVpa}
                maskedVpa={summary.upiVpaMasked}
                isActive={summary.type === "upi_manual"}
              />
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function ActiveBanner({ summary }: { summary: PaymentMethodSummary }) {
  const [pending, start] = React.useTransition();
  const confirm = useConfirm();
  const retired =
    summary.type === "stackivo_managed" || summary.type === "upi_smart";
  const label = retired ? "Retired Razorpay method" : "UPI Direct";
  const detail = retired
    ? `${summary.bankName ?? "Bank"} ••••${summary.bankAccountLast4 ?? ""}`
    : summary.upiVpaMasked;

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
          {retired ? (
            <CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none">{label}</p>
          {detail ? (
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {detail}
            </p>
          ) : null}
        </div>
        <span
          className={[
            "hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
            retired
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
          ].join(" ")}
        >
          {retired ? "Needs update" : "Active"}
        </span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="shrink-0 text-xs text-muted-foreground"
        disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: "Turn off this payment method?",
            description:
              "Clients will not see a domestic payment option until you add your UPI ID.",
            confirmLabel: "Turn off",
            variant: "destructive",
          });
          if (!ok) return;
          start(async () => {
            await clearPaymentMethodAction();
          });
        }}
      >
        {pending ? "Turning off..." : "Turn off"}
      </Button>
    </div>
  );
}

function RetiredMethodNotice() {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-400">
      <p className="font-semibold">This older Razorpay payment method is no longer used here.</p>
      <p className="mt-1 text-xs">
        Turn off the retired method above, then add your UPI ID for Indian clients.
        International clients use the separate methods section below.
      </p>
    </div>
  );
}

function UpiForm({
  initialVpa,
  maskedVpa,
  isActive,
}: {
  initialVpa: string | null;
  maskedVpa: string | null;
  isActive: boolean;
}) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(
    setUpiManualMethodAction,
    undefined,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="u-vpa" className="text-sm font-medium">
          Your UPI ID
        </Label>
        <Input
          id="u-vpa"
          name="vpa"
          placeholder="yourname@okhdfcbank"
          defaultValue={initialVpa ?? ""}
          required
          autoComplete="off"
        />
        {maskedVpa && !initialVpa ? (
          <p className="text-xs text-muted-foreground">
            Currently saved: {maskedVpa}. Re-enter to update it.
          </p>
        ) : null}
      </div>

      {state && !state.ok ? <FormError error={state.error} /> : null}
      {state?.ok ? <FormSuccess message={state.message} /> : null}

      <div className="flex justify-end">
        <UpiSubmit isActive={isActive} />
      </div>
    </form>
  );
}

function UpiSubmit({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : isActive ? "Update UPI" : "Save UPI"}
    </Button>
  );
}

function FormError({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
      <p className="text-xs text-destructive">{error}</p>
    </div>
  );
}

function FormSuccess({ message }: { message?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <p className="text-xs text-emerald-700 dark:text-emerald-400">
        {message ?? "Saved."}
      </p>
    </div>
  );
}
