import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { Reveal } from "../motion";

/**
 * Final CTA — a single dark, confident panel. The only dark moment on the
 * page, so it lands with weight. Uses foreground tokens so dark mode still
 * resolves correctly.
 */
export function FinalCta({ authState }: { authState: MarketingAuthState }) {
  const href = authState.isAuthenticated ? "/dashboard" : "/signup";
  const label = authState.isAuthenticated ? "Go to dashboard" : "Start free today";

  return (
    <section className="px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
      <Reveal className="mx-auto w-full max-w-[1200px]">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-foreground px-6 py-16 text-center sm:rounded-[2.5rem] sm:px-12 sm:py-20 lg:py-24">
          {/* Glow accents */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-[-40%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/25 blur-[100px]" />
            <div className="absolute bottom-[-50%] left-[10%] h-[300px] w-[400px] rounded-full bg-primary/15 blur-[90px]" />
          </div>

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-background/50">
            Free for your first 5 clients
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-balance font-display text-[32px] font-semibold leading-[1.1] tracking-tight text-background sm:text-5xl">
            Be the freelancer who has it together.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-background/70 sm:text-base">
            Send your first contract, invoice, and payment link in the next ten
            minutes. No card, no sales call — just a calmer way to run your
            business.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 min-w-[210px] rounded-full bg-background text-[15px] font-semibold text-foreground hover:bg-background/90"
            >
              <Link href={href} data-cta="final_cta_primary">
                {label} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 min-w-[170px] rounded-full border-background/25 bg-transparent text-[15px] text-background hover:bg-background/10 hover:text-background"
            >
              <Link href="/talk" data-cta="final_cta_talk">
                Talk to us
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-background/50">
            2-minute setup · Cancel anytime · Your data is always exportable
          </p>
        </div>
      </Reveal>
    </section>
  );
}
