import * as React from "react";
import { ArrowRight, Users, FileText, Palette, BarChart2 } from "lucide-react";
import Link from "next/link";
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
} from "@/features/settings/components/settings-section";
import {
  getBillingSubscription,
  listBillingPayments,
} from "@/features/billing/server";
import { PlanCard } from "@/features/billing/components/plan-card";
import { PlanPicker } from "@/features/billing/components/plan-picker";
import { PaymentHistory } from "@/features/billing/components/payment-history";
import { PaymentMethodCard } from "@/features/billing/components/payment-method-card";
import { SyncBillingButton } from "@/features/billing/components/sync-billing-button";
import { UsageGrid } from "@/features/billing/components/usage-grid";
import { getUsageSnapshot } from "@/features/subscription/server";
import type {
  UsageMetric,
  UsageSnapshot,
} from "@/features/subscription/types";
import { getProfile } from "@/features/profile/server";

export const dynamic = "force-dynamic";

const TRACKED_METRICS: UsageMetric[] = [
  "clients_created",
  "invoices_created",
  "projects_created",
  "storage_bytes",
];

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string; limit?: string; plan?: string }>;
}) {
  const params = await searchParams;
  const [subscription, payments, profile, ...usageSnapshots] = await Promise.all([
    getBillingSubscription(),
    listBillingPayments(20),
    getProfile(),
    ...TRACKED_METRICS.map((m) => getUsageSnapshot(m)),
  ]);

  const usage = TRACKED_METRICS.reduce(
    (acc, metric, i) => {
      acc[metric] = usageSnapshots[i] ?? null;
      return acc;
    },
    {} as Record<UsageMetric, UsageSnapshot | null>,
  );

  return (
    <>
      <SettingsPageHeader
        title="Billing"
        description="Manage your Stackivo plan, usage, payment method, receipts, and subscription lifecycle."
      />

      <div className="flex justify-end">
        <SyncBillingButton />
      </div>

      <SettingsSection
        title="Billing identity"
        description="Business details used on receipts and payment confirmations."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <SettingsField label="Business name">
            <div className="text-sm">
              {profile?.businessName ?? profile?.legalName ?? profile?.fullName ?? "—"}
            </div>
          </SettingsField>
          <SettingsField label="Contact email">
            <div className="text-sm">{profile?.businessEmail ?? profile?.email ?? "—"}</div>
          </SettingsField>
          <SettingsField label="Contact phone">
            <div className="text-sm">{profile?.businessPhone ?? profile?.phone ?? "—"}</div>
          </SettingsField>
          <SettingsField label="GSTIN">
            <div className="text-sm font-mono">{profile?.gstin ?? "—"}</div>
          </SettingsField>
        </div>
      </SettingsSection>

      <PlanCard subscription={subscription} />

      <PaymentMethodCard subscription={subscription} payments={payments} />

      {(params.upgrade || params.limit) && (
        <UpgradeInterstitial
          limitHit={params.limit}
          featureNeeded={params.upgrade}
          planNeeded={params.plan}
        />
      )}

      <SettingsSection
        title="Usage"
        description="Live counts for the current billing period."
      >
        <UsageGrid snapshots={usage} />
      </SettingsSection>

      <div id="plan-management" className="scroll-mt-20">
        <SettingsSection
          title="Plan management"
          description="Upgrade, renew, downgrade, or move back to Free from inside Stackivo. Razorpay only processes the payment."
        >
          <PlanPicker
            currentPlan={subscription?.plan ?? "free"}
            currentCycle={subscription?.billingCycle ?? "monthly"}
          />
        </SettingsSection>
      </div>

      <SettingsSection
        title="Invoices & receipts"
        description="Stackivo keeps a dashboard-native history of every subscription charge."
      >
        <PaymentHistory payments={payments} />
      </SettingsSection>

      <SettingsSection
        title="Billing help & policies"
        description="How autopay works, and where to get help."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Paid plans renew automatically until you cancel. As required, you&rsquo;ll
            receive a notification at least 24 hours before each auto-debit (sent via
            Razorpay), plus an earlier reminder from us &mdash; and you can cancel anytime
            from the plan card above. Cancelling stops future charges; you keep access
            until the end of the current period.
          </p>
          <p>
            Questions or a billing dispute? Email{" "}
            <a
              href="mailto:billing@stackivo.me"
              className="font-medium text-primary hover:underline"
            >
              billing@stackivo.me
            </a>{" "}
            and we&rsquo;ll help.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/terms" className="font-medium text-primary hover:underline">
              Terms
            </Link>
            <Link
              href="/refund-policy"
              className="font-medium text-primary hover:underline"
            >
              Refund &amp; cancellation policy
            </Link>
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              Privacy
            </Link>
          </p>
        </div>
      </SettingsSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// Warm upgrade interstitial — shown when user hits a plan limit
// ---------------------------------------------------------------------------

const PRO_BENEFITS = [
  { icon: Users, text: "Unlimited clients — no ceiling, ever" },
  { icon: FileText, text: "Contracts + e-signature in one click" },
  { icon: Palette, text: "Your logo, your branding — remove Stackivo watermark" },
  { icon: BarChart2, text: "Pulse GST reports + full analytics" },
];

function UpgradeInterstitial({
  limitHit,
  featureNeeded,
  planNeeded,
}: {
  limitHit?: string;
  featureNeeded?: string;
  planNeeded?: string;
}) {
  const isClientLimit = limitHit === "clients_created";

  const headline = isClientLimit
    ? "You've hit 5 clients — your business is growing."
    : featureNeeded
      ? `${humaniseFeature(featureNeeded ?? "")} is a Pro feature.`
      : "Ready to grow beyond the free plan?";

  const subtext = isClientLimit
    ? "The free plan holds your first 5 clients. Freelancers earning ₹5L+ / year use Pro to manage unlimited clients, send contracts, and brand their workspace — for less than a client dinner."
    : `Upgrade to ${formatPlanName(planNeeded)} to unlock this and everything else Pro includes.`;

  return (
    <div className="overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br from-primary/[0.06] via-background to-violet-500/[0.04]">
      {/* Header */}
      <div className="border-b border-primary/15 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-micro font-semibold uppercase tracking-widest text-primary">
              Upgrade to Pro
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              {headline}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground leading-relaxed">
              {subtext}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums">₹499</p>
            <p className="text-xs text-muted-foreground">per month</p>
            <p className="mt-0.5 text-micro text-success-strong font-medium">
              or ₹399/mo billed yearly
            </p>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="px-6 py-4">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PRO_BENEFITS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-3 w-3 text-primary" />
              </span>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="flex flex-col gap-2 border-t border-primary/15 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Cancel anytime · existing data always preserved · instant activation
        </p>
        <Link
          href="#plan-management"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition hover:bg-primary/90"
        >
          Upgrade to Pro now <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function humaniseFeature(feature: string): string {
  return feature.replace(/^[a-z]+\./, "").replace(/_/g, " ");
}

function formatPlanName(plan?: string): string {
  if (!plan) return "a higher plan";
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
