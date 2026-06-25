import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { Floating } from "../motion";
import { HeroMockup } from "./hero-mockup";

/**
 * Hero — landscape two-column (Keka-style): copy left, product right.
 * Server-rendered for fast LCP; the only client boundary is the gentle
 * float animation on the UI fragments.
 */
export function Hero({ authState }: { authState: MarketingAuthState }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-border/60">
      {/* Background: soft radial wash + faint grid, brand blue only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[-10%] top-[-30%] h-[600px] w-[900px] rounded-full bg-primary/[0.07] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_70%_at_70%_20%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)/0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-[1600px] items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:gap-14 lg:px-12 lg:py-16 2xl:px-16">
        {/* Copy — left */}
        <div className="max-w-xl">
          <Link
            href="/changelog"
            className="group inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] py-1 pl-1.5 pr-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            data-cta="hero_announce"
          >
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              New
            </span>
            Bill international clients in their currency
            <ArrowRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-5 text-balance font-display text-[38px] font-semibold leading-[1.06] tracking-[-0.022em] text-foreground sm:text-5xl lg:text-[56px]">
            Win clients worldwide. Run it all from <span className="text-gradient">one place</span>.
          </h1>

          <p className="mt-5 max-w-lg text-pretty text-[15px] leading-[1.7] text-muted-foreground sm:text-base lg:text-[17px]">
            Contracts, invoices, projects, time and payments — built for Indian
            freelancers working with clients in the US, UK, EU and beyond.
            Invoice in their currency, get paid your way, and stay GST-compliant.
          </p>

          <HeroCtas authState={authState} />

          <p className="mt-4 text-[13px] text-muted-foreground/80">
            Free for your first 5 clients · No card required · 2-minute setup
          </p>
        </div>

        {/* Product visual — right */}
        <div className="relative lg:pl-2">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/[0.14] via-primary/[0.05] to-transparent blur-2xl"
          />

          {/* Floating fragments — desktop only */}
          <Floating
            amplitude={6}
            duration={6}
            className="absolute -left-6 top-8 z-10 hidden xl:block"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3 pr-4 shadow-xl shadow-primary/10 backdrop-blur">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-foreground">Payment received</p>
                <p className="text-[11px] text-muted-foreground">$1,200 · INV-0042 · via Wise</p>
              </div>
            </div>
          </Floating>

          <Floating
            amplitude={6}
            duration={8}
            className="absolute -bottom-4 right-2 z-10 hidden xl:block"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3 pr-4 shadow-xl shadow-primary/10 backdrop-blur">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M11 2.5 13.5 5 6 12.5l-3 .5.5-3L11 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[12px] font-semibold text-foreground">Contract signed</p>
                <p className="text-[11px] text-muted-foreground">Meera Iyer · just now</p>
              </div>
            </div>
          </Floating>

          {/* Browser frame */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-primary/[0.12] ring-1 ring-foreground/[0.04]">
            <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
                <span className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
              </span>
              <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background px-3 py-1 text-[11px] text-muted-foreground ring-1 ring-border/60">
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-success" fill="none" aria-hidden>
                  <rect x="2" y="5" width="8" height="5.5" rx="1.2" stroke="currentColor" />
                  <path d="M4 5V3.8a2 2 0 0 1 4 0V5" stroke="currentColor" />
                </svg>
                app.stackivo.com
              </span>
            </div>
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCtas({ authState }: { authState: MarketingAuthState }) {
  if (authState.isAuthenticated) {
    return (
      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="btn-gradient h-12 min-w-[190px] rounded-full border-0 text-[15px] font-semibold">
          <Link href="/dashboard" data-cta="hero_dashboard">
            Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        {authState.showUpgradeNudge ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 min-w-[160px] rounded-full text-[15px] hover:border-primary/40 hover:bg-primary/5"
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
      <Button asChild size="lg" className="btn-gradient h-12 min-w-[190px] rounded-full border-0 text-[15px] font-semibold">
        <Link href="/signup" data-cta="hero_primary">
          Start free <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="h-12 min-w-[160px] rounded-full text-[15px] hover:border-primary/40 hover:bg-primary/5"
      >
        <Link href="/demo" data-cta="hero_demo">
          <Play className="mr-1.5 h-4 w-4 fill-current" /> See it in action
        </Link>
      </Button>
    </div>
  );
}
