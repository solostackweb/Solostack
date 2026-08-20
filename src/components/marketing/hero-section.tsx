import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowRight, CreditCard, Receipt, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "./dashboard-mockup";
import type { MarketingAuthState } from "@/features/marketing/types";

/**
 * Hero — left-aligned two-column layout (copy left, product visual right),
 * inspired by clean B2B SaaS heroes (e.g. Keka). No centered text, no gradient
 * headline, a solid dark heading, tight vertical rhythm so it fits on screen.
 *
 * Server-rendered for fast LCP — effects are pure CSS.
 */
export function HeroSection({ authState }: { authState: MarketingAuthState }) {
  return (
    <section className="relative isolate overflow-hidden border-b bg-background">
      {/* One soft, restrained wash — top-left, brand blue only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-[10%] -top-[20%] h-[420px] w-[620px] rounded-full bg-primary/[0.07] blur-3xl" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 pb-14 pt-12 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-12 lg:pb-16 lg:pt-16">
        {/* Copy — left aligned */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Built for freelancers &amp; small studios
          </span>

          <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Everything you need to run your freelance business
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Clients, invoices, contracts, projects, time tracking, and payments —
            one clean workspace. Simple invoices or full GST, your call. Free for
            your first 5 clients, always.
          </p>

          <HeroCtas authState={authState} />

          {/* Trust row */}
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            <TrustItem icon={Receipt} label="Simple & GST invoices" />
            <TrustItem icon={ShieldCheck} label="TLS · daily backups" />
            <TrustItem icon={CreditCard} label="No card required" />
          </div>

          {/* Rating */}
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-warning-strong" />
              ))}
            </span>
            <span className="font-medium text-foreground">Loved by freelancers across India</span>
          </div>
        </div>

        {/* Product visual — right, contained */}
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/[0.08] to-transparent blur-2xl"
          />
          <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10 ring-1 ring-black/[0.04]">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustItem({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary/70" />
      {label}
    </span>
  );
}

function HeroCtas({ authState }: { authState: MarketingAuthState }) {
  if (authState.isAuthenticated) {
    return (
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button
          asChild
          size="lg"
          className="btn-gradient h-12 min-w-[190px] rounded-full border-0 text-base"
        >
          <Link href="/dashboard" data-cta="hero_dashboard">
            Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        {authState.showUpgradeNudge ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 min-w-[160px] rounded-full border-primary/30 text-base hover:border-primary/60 hover:bg-primary/5"
          >
            <Link href="/dashboard/settings/billing?upgrade=clients" data-cta="hero_upgrade">
              Upgrade to Pro
            </Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
      <Button
        asChild
        size="lg"
        className="btn-gradient h-12 min-w-[180px] rounded-full border-0 text-base"
      >
        <Link href="/signup" data-cta="hero_primary">
          Start for free <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="h-12 min-w-[150px] rounded-full border-border text-base hover:border-primary/40 hover:bg-primary/5"
      >
        <Link href="/pricing" data-cta="hero_pricing">See pricing</Link>
      </Button>
    </div>
  );
}
