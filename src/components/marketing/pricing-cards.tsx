"use client";

import * as React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StaggerReveal, StaggerItem } from "./motion";
import type { MarketingAuthState } from "@/features/marketing/types";
import { useTrack } from "@/lib/analytics/track";

type Billing = "monthly" | "yearly";

interface Tier {
  id: "free" | "pro" | "business";
  name: string;
  blurb: string;
  monthly: number; // rupees
  yearly: number; // rupees per year (effective)
  ctaLabel: string;
  ctaHref: string;
  popular?: boolean;
  features: string[];
  comingSoon?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Start running your freelance business. Forever free.",
    monthly: 0,
    yearly: 0,
    ctaLabel: "Start free",
    ctaHref: "/signup",
    features: [
      "Up to 5 lifetime clients",
      "Unlimited GST-ready invoices",
      "Contracts, projects, and basic Pulse",
      "GST-ready invoicing engine",
      "PDF download & invoice sharing",
      "Basic dashboard & notifications",
      "100 MB file storage",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "Unlimited everything, plus the premium toolkit.",
    monthly: 499,
    yearly: 4788, // ₹399/mo × 12 — 2 months free
    ctaLabel: "Start free, upgrade later",
    ctaHref: "/signup",
    popular: true,
    features: [
      "Unlimited clients & projects",
      "Custom invoice branding (remove watermark)",
      "Advanced contracts and templates",
      "Time tracking, billable rates & reports",
      "Client portal",
      "Razorpay / UPI payment gateway",
      "Pulse analytics (12-month history)",
      "Recurring invoices & bulk reminders",
      "5 GB file storage",
    ],
  },
  {
    id: "business",
    name: "Business",
    blurb: "For design studios and small dev agencies.",
    monthly: 1499,
    yearly: 14388, // ₹1,199/mo × 12 — 2 months free
    // The Business tier isn't billable yet — direct interested visitors
    // to the contact page (which has live chat + form + email) so we
    // capture intent instead of dropping them on a 404.
    ctaLabel: "Talk to us",
    ctaHref: "/contact?topic=business",
    comingSoon: true,
    features: [
      "Everything in Pro",
      "Up to 5 team members",
      "API access & webhooks",
      "Project collaborators",
      "White-label portal (custom domain)",
      "Priority + phone support",
      "50 GB file storage",
    ],
  },
];

export function PricingCards({
  authState,
}: {
  authState: MarketingAuthState;
}) {
  const track = useTrack();
  const [billing, setBilling] = React.useState<Billing>("monthly");

  // Fire one `marketing.pricing.viewed` per mount so we can build the
  // landing → pricing → signup funnel without relying on raw pageviews.
  // PostHog initialises asynchronously, so we wait until `track` is the
  // wired-up version, and use a ref to avoid double-firing on re-render.
  const fired = React.useRef(false);
  React.useEffect(() => {
    if (fired.current) return;
    track("marketing.pricing.viewed", {
      plan: authState.plan ?? undefined,
      authed: authState.isAuthenticated,
    });
    fired.current = true;
  }, [track, authState.plan, authState.isAuthenticated]);

  const handleBillingChange = (b: Billing) => {
    setBilling(b);
    track("marketing.pricing.toggle_changed", { billing: b });
  };

  return (
    <div>
      <BillingToggle billing={billing} onChange={handleBillingChange} />

      <StaggerReveal
        className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6"
        amount={0.15}
      >
        {TIERS.map((t) => (
          <StaggerItem key={t.id} className="h-full">
            <PricingCard
              tier={t}
              billing={billing}
              authState={authState}
            />
          </StaggerItem>
        ))}
      </StaggerReveal>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Free forever for your first 5 clients. No credit card required. All prices in INR; GST extra where applicable.
      </p>
    </div>
  );
}

function BillingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (b: Billing) => void;
}) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-primary/15 bg-card p-1 text-sm shadow-sm shadow-primary/5">
      {(["monthly", "yearly"] as const).map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onChange(b)}
          aria-pressed={billing === b}
          className={cn(
            "rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200",
            billing === b
              ? "btn-gradient shadow-sm text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {b === "monthly" ? "Monthly" : "Yearly · 2 months free"}
        </button>
      ))}
    </div>
  );
}

function PricingCard({
  tier,
  billing,
  authState,
}: {
  tier: Tier;
  billing: Billing;
  authState: MarketingAuthState;
}) {
  const price = billing === "monthly" ? tier.monthly : Math.round(tier.yearly / 12);
  const isFree = tier.monthly === 0;
  return (
    <div
      className={cn(
        "relative flex h-full flex-col rounded-2xl border bg-card p-7 transition-all duration-250 ease-out sm:p-8 lg:p-9",
        tier.popular
          ? "border-primary/50 bg-gradient-to-b from-primary/[0.05] to-transparent shadow-2xl shadow-primary/15 glow-ring"
          : "hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.06]",
        tier.comingSoon && "opacity-70",
      )}
    >
      {tier.popular ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-primary/[0.18] via-primary/[0.08] to-transparent blur-lg"
        />
      ) : null}
      {tier.popular ? (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-lg shadow-primary/25" style={{ backgroundImage: "linear-gradient(135deg, hsl(243 75% 52%), hsl(262 83% 58%))" }}>
          Most popular
        </span>
      ) : null}
      {tier.comingSoon ? (
        <span className="absolute -top-3 left-6 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Coming soon
        </span>
      ) : null}

      <div>
        <h3 className="text-base font-semibold tracking-tight">{tier.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
      </div>

      <div className="mt-5 flex items-baseline gap-1">
        {isFree ? (
          <span className="font-mono text-4xl font-bold tracking-tight">₹0</span>
        ) : (
          <>
            <span className="font-mono text-4xl font-bold tracking-tight">
              ₹{price.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-muted-foreground">
              /mo{billing === "yearly" ? " · billed yearly" : ""}
            </span>
          </>
        )}
      </div>
      {/* Savings hint — "2 months free" framing converts better than % */}
      {!isFree && billing === "yearly" ? (
        <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
          2 months free · save ₹{(tier.monthly * 12 - tier.yearly).toLocaleString("en-IN")}/yr
        </p>
      ) : null}

      <PlanCta tier={tier} authState={authState} />

      <ul className="mt-6 space-y-2.5">
        {tier.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-muted-foreground">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanCta({
  tier,
  authState,
}: {
  tier: Tier;
  authState: MarketingAuthState;
}) {
  if (authState.isAuthenticated) {
    if (tier.id === "free") {
      return (
        <Button asChild className="mt-6 w-full rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5" variant="outline">
          <Link href="/dashboard">Proceed to Dashboard</Link>
        </Button>
      );
    }

    if (tier.id === "pro") {
      return (
        <Button asChild className="btn-gradient mt-6 w-full rounded-xl border-0" variant="default">
          <Link href="/dashboard/settings/billing?plan=pro">
            {authState.plan === "pro" ? "Manage Pro" : "Upgrade in dashboard"}
          </Link>
        </Button>
      );
    }

    return (
      <Button asChild className="mt-6 w-full rounded-xl border-dashed" variant="outline">
        <Link href="/dashboard/settings/billing?plan=business">
          View in dashboard
        </Link>
      </Button>
    );
  }

  // Unauthenticated — show sign-up or coming-soon CTA
  if (tier.comingSoon) {
    return (
      <Button
        className="mt-6 w-full cursor-not-allowed rounded-xl border-dashed opacity-60"
        variant="outline"
        disabled
      >
        Coming soon
      </Button>
    );
  }

  if (tier.popular) {
    return (
      <>
        <Button asChild className="btn-gradient mt-6 w-full rounded-xl border-0">
          <Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          No credit card required
        </p>
      </>
    );
  }

  return (
    <>
      <Button
        asChild
        className="mt-6 w-full rounded-xl border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        variant="outline"
      >
        <Link href={tier.ctaHref}>{tier.ctaLabel}</Link>
      </Button>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        No credit card required
      </p>
    </>
  );
}
