import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { HeroFlow } from "./hero-flow";

export function Hero({ authState }: { authState: MarketingAuthState }) {
  const primary = authState.isAuthenticated
    ? { href: "/dashboard", label: "Go to dashboard", tag: "hero_dashboard" }
    : { href: "/signup", label: "Start free — 5 clients", tag: "hero_primary" };

  const secondary = authState.isAuthenticated && authState.showUpgradeNudge
    ? { href: "/dashboard/settings/billing?upgrade=clients", label: "Upgrade to Pro", tag: "hero_upgrade" }
    : { href: "/demo", label: "Explore the workspace", tag: "hero_demo" };

  return (
    <section className="relative isolate overflow-hidden border-b border-border pt-24 sm:pt-28 lg:pt-32">
      <div aria-hidden className="absolute -left-40 top-0 -z-10 h-[480px] w-[480px] rounded-full bg-accent/75 blur-3xl" />
      <div aria-hidden className="absolute -right-40 top-0 -z-10 h-[440px] w-[440px] rounded-full bg-secondary blur-3xl" />

      <div className="mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl text-center">
          <p className="font-mono text-micro font-medium uppercase tracking-[0.14em] text-primary">
            Your client work, connected
          </p>
          <h1 className="mx-auto mt-5 max-w-[880px] text-balance font-display text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
            From first brief to <span className="text-primary">final payment.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[660px] text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Run clients, projects, contracts, invoices, GST and payments from one calm workspace.
            The work and the money finally share the same context.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 rounded-lg px-6 text-sm font-semibold shadow-[0_12px_28px_-16px_hsl(var(--primary)/0.85)]">
              <Link href={primary.href} data-cta={primary.tag}>
                {primary.label}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-lg border-input bg-card px-6 text-sm font-semibold hover:border-primary/35 hover:bg-accent/50">
              <Link href={secondary.href} data-cta={secondary.tag}>{secondary.label}</Link>
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {["No card required", "GST-ready from day one", "Two-minute setup"].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroFlow />
      </div>
    </section>
  );
}
