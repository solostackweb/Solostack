"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listPlans } from "@/features/subscription/plans";
import type { PlanDefinition, PlanId } from "@/features/subscription/types";
import type { BillingCycle } from "../types";
import { CheckoutButton } from "./checkout-button";
import { publicRazorpayKeyId } from "@/config/env";

interface Props {
  currentPlan: PlanId;
  currentCycle: BillingCycle;
}

const PERKS_PER_PLAN: Record<PlanId, string[]> = {
  free: [
    "5 lifetime clients",
    "Unlimited invoices, projects, contracts",
    "GST-aware invoicing",
    "100 MB file storage",
  ],
  pro: [
    "Unlimited clients",
    "Custom invoice branding",
    "Client portal",
    "Contract e-signatures",
    "Time tracking & billable rates",
    "Advanced Pulse reports",
    "5 GB file storage",
  ],
  business: [
    "Everything in Pro",
    "API access",
    "Project collaborators",
    "Priority support",
    "50 GB file storage",
  ],
};

/**
 * Plan picker shown on the billing page. Lets the user switch billing
 * cycle and start a checkout for any paid plan. The current plan is
 * pre-selected and disabled.
 */
export function PlanPicker({ currentPlan, currentCycle }: Props) {
  const [cycle, setCycle] = React.useState<BillingCycle>(currentCycle);
  const plans = listPlans();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold tracking-tight">Change plan</p>
          <p className="text-sm text-muted-foreground">
            Upgrade, downgrade, or switch billing cycle anytime.
          </p>
        </div>
        <CycleToggle value={cycle} onChange={setCycle} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanTile
            key={p.id}
            plan={p}
            cycle={cycle}
            isCurrent={p.id === currentPlan}
          />
        ))}
      </div>
    </div>
  );
}

function CycleToggle({
  value,
  onChange,
}: {
  value: BillingCycle;
  onChange: (v: BillingCycle) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-xs">
      {(["monthly", "yearly"] as const).map((cycle) => (
        <button
          key={cycle}
          type="button"
          onClick={() => onChange(cycle)}
          className={cn(
            "rounded-[4px] px-3 py-1 font-medium transition-colors",
            value === cycle
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {cycle === "monthly" ? "Monthly" : "Yearly"}
          {cycle === "yearly" && (
            <span className="ml-1 text-xs text-success">−2 mo</span>
          )}
        </button>
      ))}
    </div>
  );
}

function PlanTile({
  plan,
  cycle,
  isCurrent,
}: {
  plan: PlanDefinition;
  cycle: BillingCycle;
  isCurrent: boolean;
}) {
  const isPaid = plan.id !== "free";
  const price =
    cycle === "yearly"
      ? plan.priceYearlyPaise ?? plan.priceMonthlyPaise
      : plan.priceMonthlyPaise;
  const features = PERKS_PER_PLAN[plan.id];
  const popular = plan.id === "pro";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-5 text-left",
        popular && !isCurrent && "border-primary/50 bg-primary/[0.02]",
      )}
    >
      {popular && (
        <Badge className="absolute right-3 top-3 h-5 gap-1 px-1.5 text-micro">
          <Sparkles className="h-3 w-3" /> Popular
        </Badge>
      )}
      <p className="text-sm font-semibold">{plan.name}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">
        {price === null
          ? "Custom"
          : price === 0
            ? "Free"
            : new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(price / 100)}
      </p>
      <p className="text-xs text-muted-foreground">
        {price && price > 0
          ? `per ${cycle === "yearly" ? "year" : "month"}`
          : "forever"}
      </p>

      <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          <Badge variant="secondary" className="h-6">
            Current plan
          </Badge>
        ) : isPaid ? (
          publicRazorpayKeyId ? (
            <CheckoutButton
              plan={plan.id as "pro" | "business"}
              cycle={cycle}
              variant={popular ? "default" : "outline"}
              size="sm"
              className="w-full"
              label={`Switch to ${plan.name}`}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Billing is not configured yet. Check back soon.
            </p>
          )
        ) : (
          <span className="text-xs text-muted-foreground">
            Cancel any paid plan to return to Free.
          </span>
        )}
      </div>
    </div>
  );
}
