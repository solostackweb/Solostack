import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { Floating } from "../motion";
import { HeroMockup } from "./hero-mockup";

/**
 * Hero — centered, cinematic. Copy on top, full-width product visual below
 * with floating UI fragments for depth. Server-rendered for fast LCP; the
 * only client boundary is the gentle float animation on the fragments.
 */
export function Hero({ authState }: { authState: MarketingAuthState }) {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Background: soft radial wash + faint grid, brand blue only. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-30%] h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--border)/0.7) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.7) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-5 pt-16 sm:px-8 sm:pt-20 lg:pt-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Link
            href="/changelog"
            className="group inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] py-1 pl-1.5 pr-3 text-[13px] font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
            data-cta="hero_announce"
          >
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              New
            </span>
            Stackivo AI is in your workspace
            <ArrowRight className="h-3 w-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <h1 className="mt-6 text-balance font-display text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] text-foreground sm:text-6xl lg:text-[68px]">
            Your client work,
            <br />
            finally in <span className="text-gradient">one place</span>.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-[1.7] text-muted-foreground sm:text-lg">
            Contracts, invoices, projects, time and payments — Stackivo replaces
            the six tools you juggle with one fast workspace. GST-ready, built
            for Indian freelancers and studios.
          </p>

          <HeroCtas authState={authState} />

          <p className="mt-5 text-[13px] text-muted-foreground/80">
            Free for your first 5 clients · No card required · 2-minute setup
          </p>
        </div>
      </div>

      {/* Product visual */}
      <div className="relative mx-auto mt-14 w-full max-w-[1200px] px-5 sm:mt-16 sm:px-8 lg:mt-20">
        {/* Glow behind the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-6 -z-10 h-3/4 rounded-[3rem] bg-gradient-to-b from-primary/20 via-primary/[0.06] to-transparent blur-3xl"
        />

        <div className="relative">
          {/* Floating fragments — hidden on small screens to keep mobile clean */}
          <Floating
            amplitude={6}
            duration={6}
            className="absolute -left-4 top-10 z-10 hidden lg:block xl:-left-10"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3.5 pr-5 shadow-xl shadow-primary/10 backdrop-blur">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[13px] font-semibold text-foreground">Payment received</p>
                <p className="text-xs text-muted-foreground">₹48,000 · INV-0042 · Razorpay</p>
              </div>
            </div>
          </Floating>

          <Floating
            amplitude={7}
            duration={8}
            className="absolute -right-4 top-24 z-10 hidden lg:block xl:-right-10"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-3.5 pr-5 shadow-xl shadow-primary/10 backdrop-blur">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
                  <path d="M11 2.5 13.5 5 6 12.5l-3 .5.5-3L11 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[13px] font-semibold text-foreground">Contract signed</p>
                <p className="text-xs text-muted-foreground">Meera Iyer · just now</p>
              </div>
            </div>
          </Floating>

          <Floating
            amplitude={5}
            duration={7}
            className="absolute -bottom-5 left-[12%] z-10 hidden lg:block"
          >
            <div className="flex items-center gap-2.5 rounded-full border border-border/80 bg-card/95 py-2 pl-3 pr-4 shadow-lg shadow-primary/10 backdrop-blur">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="font-mono text-[13px] font-medium text-foreground">02:41:08</span>
              <span className="text-xs text-muted-foreground">Tracking · Website revamp</span>
            </div>
          </Floating>

          {/* Browser frame */}
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-primary/[0.12] ring-1 ring-foreground/[0.04] sm:rounded-[20px]">
            <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2.5">
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

        {/* Fade the mockup into the next section */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-gradient-to-t from-background to-transparent"
        />
      </div>
    </section>
  );
}

function HeroCtas({ authState }: { authState: MarketingAuthState }) {
  if (authState.isAuthenticated) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild size="lg" className="btn-gradient h-12 min-w-[200px] rounded-full border-0 text-[15px] font-semibold">
          <Link href="/dashboard" data-cta="hero_dashboard">
            Go to dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        {authState.showUpgradeNudge ? (
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 min-w-[170px] rounded-full text-[15px] hover:border-primary/40 hover:bg-primary/5"
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
    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
      <Button asChild size="lg" className="btn-gradient h-12 min-w-[200px] rounded-full border-0 text-[15px] font-semibold">
        <Link href="/signup" data-cta="hero_primary">
          Start free <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        size="lg"
        className="h-12 min-w-[170px] rounded-full text-[15px] hover:border-primary/40 hover:bg-primary/5"
      >
        <Link href="/demo" data-cta="hero_demo">
          <Play className="mr-1.5 h-4 w-4 fill-current" /> See it in action
        </Link>
      </Button>
    </div>
  );
}
