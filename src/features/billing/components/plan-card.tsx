import * as React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PLANS } from "@/features/subscription/plans";
import { CancelSubscriptionButton } from "./cancel-subscription-button";
import { ReactivateButton } from "./reactivate-button";
import { deriveLifecycle } from "../state";
import type { BillingSubscription } from "../types";

interface Props {
  subscription: BillingSubscription | null;
}

const STATUS_TONE: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "muted" }
> = {
  active: { label: "Active", tone: "success" },
  trialing: { label: "Trialing", tone: "success" },
  past_due: { label: "Past due", tone: "warning" },
  paused: { label: "Paused", tone: "warning" },
  canceled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
};

export function PlanCard({ subscription }: Props) {
  const plan = subscription ? PLANS[subscription.plan] : PLANS.free;
  const lifecycle = deriveLifecycle(subscription);
  const status = subscription?.status ?? "active";
  const meta = STATUS_TONE[status] ?? STATUS_TONE.active;

  const isFree = !subscription || subscription.plan === "free";
  const renewsOn = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : null;
  const cancelDate = lifecycle.isCanceledAtPeriodEnd
    ? subscription?.currentPeriodEnd
    : subscription?.endedAt;
  // Recurring amount + the actual next auto-debit date (autopay transparency).
  const recurringPaise =
    subscription?.billingCycle === "yearly"
      ? plan.priceYearlyPaise ?? 0
      : plan.priceMonthlyPaise ?? 0;
  const nextChargeDate = subscription?.nextChargeAt ?? subscription?.currentPeriodEnd;

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Current plan
            </p>
            <div className="mt-1 flex items-center gap-2.5">
              <h2 className="text-2xl font-semibold tracking-tight">{plan.name}</h2>
              <Badge
                className={cn(
                  "h-5 px-1.5 text-[10px]",
                  meta.tone === "success" && "bg-success/10 text-success",
                  meta.tone === "warning" && "bg-warning/10 text-warning",
                  meta.tone === "danger" && "bg-destructive/10 text-destructive",
                  meta.tone === "muted" && "bg-muted text-muted-foreground",
                )}
              >
                {meta.label}
              </Badge>
              {lifecycle.isCanceledAtPeriodEnd && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Cancels at period end
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
          </div>
          {!isFree && plan.priceMonthlyPaise !== null && (
            <p className="text-right tabular-nums">
              <span className="text-2xl font-semibold tracking-tight">
                {formatCurrency(
                  subscription?.billingCycle === "yearly"
                    ? plan.priceYearlyPaise ?? 0
                    : plan.priceMonthlyPaise,
                )}
              </span>
              <span className="ml-1 text-xs text-muted-foreground">
                / {subscription?.billingCycle === "yearly" ? "year" : "month"}
              </span>
            </p>
          )}
        </div>

        {/* Lifecycle banners */}
        {lifecycle.isPastDue && !lifecycle.isInGracePeriod && (
          <Banner
            tone="danger"
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Payment overdue"
            body="Your last subscription charge failed. Paid features have been disabled until payment is collected."
          />
        )}
        {lifecycle.isInGracePeriod && (
          <Banner
            tone="warning"
            icon={<Clock className="h-4 w-4" />}
            title={`Grace period — ${lifecycle.daysUntilGraceEnds ?? 0} day(s) left`}
            body="We'll keep retrying your payment. Update your card to avoid losing access to paid features."
          />
        )}
        {lifecycle.isCanceledAtPeriodEnd && cancelDate && (
          <Banner
            tone="muted"
            icon={<Clock className="h-4 w-4" />}
            title={`Plan ends ${formatDate(cancelDate)}`}
            body="You'll keep paid features until then. Reactivate any time before the period closes."
          />
        )}

        {/* Meta row */}
        <dl className="grid gap-4 border-t pt-5 sm:grid-cols-3">
          {lifecycle.isCanceledAtPeriodEnd ? (
            <Stat
              label="Ends on"
              value={renewsOn ?? "—"}
              hint="Paid features stay active until this date"
            />
          ) : !isFree && status === "active" ? (
            <Stat
              label="Next charge"
              value={
                nextChargeDate
                  ? `${formatCurrency(recurringPaise)} · ${formatDate(nextChargeDate)}`
                  : "—"
              }
              hint={`Auto-debit · billed ${subscription?.billingCycle ?? "monthly"}`}
            />
          ) : (
            <Stat
              label="Renews on"
              value={renewsOn ?? "—"}
              hint={
                !isFree
                  ? `Billed ${subscription?.billingCycle ?? "monthly"}`
                  : undefined
              }
            />
          )}
          <Stat
            label="Last payment"
            value={
              subscription?.lastPaymentAt
                ? formatDate(subscription.lastPaymentAt)
                : "—"
            }
          />
          <Stat
            label="Status"
            value={meta.label}
            icon={
              meta.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : null
            }
          />
        </dl>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t pt-5">
          {!isFree && status === "active" && !lifecycle.isCanceledAtPeriodEnd && (
            <CancelSubscriptionButton cancelsOn={subscription?.currentPeriodEnd ?? null} />
          )}
          {(status === "canceled" ||
            status === "expired" ||
            lifecycle.isCanceledAtPeriodEnd ||
            lifecycle.isPastDue) && <ReactivateButton />}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums">
        {icon}
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  body,
}: {
  tone: "danger" | "warning" | "muted";
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3 text-sm",
        tone === "danger" && "border-destructive/30 bg-destructive/5 text-destructive",
        tone === "warning" && "border-warning/30 bg-warning/5 text-warning",
        tone === "muted" && "border-border bg-muted/40 text-foreground",
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs opacity-80">{body}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
