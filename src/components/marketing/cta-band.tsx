import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";

export function CtaBand({
  authState,
}: {
  authState: MarketingAuthState;
}) {
  const authed = authState.isAuthenticated;

  return (
    <section className="relative isolate overflow-hidden border-y border-primary/10">
      {/* Stripe-style rich gradient wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.10] via-primary/[0.06] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-tl from-primary/[0.08] via-transparent to-transparent" />
      </div>
      {/* Dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.18] [background-image:radial-gradient(hsl(var(--primary)/0.5)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_55%_65%_at_50%_50%,#000,transparent_82%)]"
      />
      <div className="relative mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28 xl:px-14 2xl:px-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-[42px] lg:text-[54px] lg:leading-[1.04] lg:tracking-[-0.025em]">
            {authed
              ? <>Your workspace is <span className="text-gradient">ready when you are.</span></>
              : <>Run your freelance business <span className="text-gradient">like a real one.</span></>}
          </h2>
          <p className="mt-5 text-pretty text-base leading-[1.8] text-muted-foreground sm:text-[17px]">
            {authed
              ? authState.showUpgradeNudge
                ? "Need more clients? Upgrade inside Stackivo and keep your billing, usage, receipts, and plan controls in one place."
                : "Jump back into clients, invoices, contracts, projects, time, and Pulse without leaving the Stackivo flow."
              : "Start free in under 60 seconds. Five clients, every workflow, zero credit card."}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {authed ? (
              <>
                <Button asChild size="lg" className="btn-gradient h-12 min-w-[200px] rounded-full border-0">
                  <Link href="/dashboard" data-cta="cta_band_dashboard">
                    Proceed to Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                {authState.showUpgradeNudge ? (
                  <Button asChild variant="outline" size="lg" className="h-12 min-w-[170px] rounded-full border-primary/25 hover:border-primary/50 hover:bg-primary/5">
                    <Link href="/dashboard/settings/billing?upgrade=clients" data-cta="cta_band_upgrade">
                      Upgrade to Pro
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button asChild size="lg" className="btn-gradient h-12 min-w-[160px] rounded-full border-0">
                  <Link href="/signup" data-cta="cta_band_primary">
                    Start Free <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 min-w-[120px] rounded-full border-primary/20 hover:border-primary/40 hover:bg-primary/5">
                  <Link href="/login" data-cta="cta_band_login">Log in</Link>
                </Button>
              </>
            )}
          </div>
          <p className="mt-5 text-xs text-muted-foreground/60">No credit card required · Free for 5 clients forever</p>
        </div>
      </div>
    </section>
  );
}
