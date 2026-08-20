import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { InvoiceDocument } from "./invoice-document";

/**
 * Hero — Ledger.
 *
 * v1 was a Keka-style two-column with a product mockup wrapped in a radial
 * blur, a masked grid and two infinitely floating glass fragments. Every one
 * of those is a default of the genre, and with no real screenshot to put on
 * the right the fragments were inventing content. MASTER.md §8 replaces them
 * with a real artifact: an invoice, typeset.
 *
 * No background wash, no grid, no blur — depth is the offset paper block
 * behind the document (MASTER.md §6). Server component throughout; nothing
 * here needs JS, so the LCP is the headline and it paints immediately.
 */
export function Hero({ authState }: { authState: MarketingAuthState }) {
  return (
    <section className="relative border-b border-border">
      <div className="mx-auto grid w-full max-w-[1400px] items-center gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-20 lg:px-10 lg:py-24 xl:px-14">
        <div className="max-w-xl">
          <p className="flex items-center gap-3 font-mono text-micro font-medium uppercase tracking-[0.16em] text-primary">
            For Indian independents
            <span aria-hidden className="h-px w-16 bg-border" />
          </p>

          <h1 className="mt-7 text-balance font-display text-4xl font-normal leading-[1.02] tracking-[-0.015em] text-foreground sm:text-5xl lg:text-6xl">
            Every rupee you&rsquo;ve earned,{" "}
            <em className="italic text-primary">accounted for.</em>
          </h1>

          <p className="mt-6 max-w-[46ch] text-pretty text-base leading-[1.7] text-muted-foreground sm:text-lg">
            Clients, invoices, contracts, projects and payments in one
            workspace. GST computed correctly the first time &mdash; whether the
            client is in Karnataka, Maharashtra, or Berlin.
          </p>

          <HeroCtas authState={authState} />

          <ul className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-xs text-muted-foreground">
            {["No card required", "GSTR-1 ready exports", "Two-minute setup"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:pl-4">
          <InvoiceDocument />
        </div>
      </div>
    </section>
  );
}

function HeroCtas({ authState }: { authState: MarketingAuthState }) {
  const cta = authState.isAuthenticated
    ? { href: "/dashboard", label: "Go to dashboard", tag: "hero_dashboard" }
    : { href: "/signup", label: "Start free — 5 clients", tag: "hero_primary" };

  const secondary =
    authState.isAuthenticated && authState.showUpgradeNudge
      ? { href: "/dashboard/settings/billing?upgrade=clients", label: "Upgrade to Pro", tag: "hero_upgrade" }
      : { href: "/demo", label: "See a live invoice", tag: "hero_demo" };

  return (
    <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
      <Button asChild size="lg" className="h-12 rounded-sm px-6 text-sm font-medium">
        <Link href={cta.href} data-cta={cta.tag}>
          {cta.label}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>

      <Link
        href={secondary.href}
        data-cta={secondary.tag}
        className="group inline-flex w-fit items-center gap-1.5 border-b border-foreground pb-0.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        {secondary.label}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
