import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/features/subscription/plans";
import { Section, SectionHeading } from "../section";
import { Reveal, StaggerItem, StaggerReveal } from "../motion";
import { cn } from "@/lib/utils";

/**
 * Pricing teaser — three compact cards that read in five seconds.
 * Prices come from the plan catalogue so this never drifts from billing.
 */
function rupees(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

const HIGHLIGHTS: Record<string, string[]> = {
  free: [
    "Your first 5 clients, free forever",
    "GST-ready invoices & payment links",
    "Projects, time tracking & Pulse",
  ],
  pro: [
    "Everything in Free, unlimited clients",
    "Contracts with e-signature",
    "Branded client portal",
  ],
  business: [
    "Everything in Pro",
    "For studios and small teams",
    "Priority support",
  ],
};

export function PricingTeaser() {
  const plans = [PLANS.free, PLANS.pro, PLANS.business];

  return (
    <Section id="pricing" size="wide" className="border-t border-border bg-muted/30">
      <Reveal>
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Upgrade when you outgrow it."
          subtitle="No card to start, no per-invoice fees, no surprises. Pay yearly and get about two months free."
        />
      </Reveal>

      <StaggerReveal className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3 lg:mt-12">
        {plans.map((plan) => {
          const featured = plan.id === "pro";
          return (
            <StaggerItem key={plan.id} className="h-full">
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-card p-7",
                  featured
                    ? "border-primary/35 shadow-[0_24px_60px_-38px_hsl(224_45%_28%/0.42)]"
                    : "border-border/80",
                )}
              >
                {featured ? (
                  <span className="absolute -top-3 left-6 rounded-lg bg-primary px-3 py-1 text-micro font-semibold uppercase tracking-[0.12em] text-primary-foreground">
                    Most popular
                  </span>
                ) : null}

                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-semibold tracking-tight text-foreground">
                    {plan.priceMonthlyPaise ? rupees(plan.priceMonthlyPaise) : "₹0"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.priceMonthlyPaise ? "/month" : "forever"}
                  </span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">{plan.description}</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {(HIGHLIGHTS[plan.id] ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  asChild
                  className={cn(
                    "mt-7 h-11 w-full rounded-lg text-sm font-semibold",
                  )}
                  variant={featured ? "default" : "outline"}
                >
                  <Link href="/signup" data-cta={`pricing_teaser_${plan.id}`}>
                    {plan.id === "free" ? "Start free" : `Start with ${plan.name}`}
                  </Link>
                </Button>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerReveal>

      <Reveal delay={0.2} className="mt-8">
        <Link
          href="/pricing"
          data-cta="pricing_teaser_compare"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
        >
          Compare every plan in detail
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>
    </Section>
  );
}
