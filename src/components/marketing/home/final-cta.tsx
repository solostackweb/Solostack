import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { Reveal } from "../motion";

/**
 * Closing CTA: one clear decision and a quieter conversation path.
 */
export function FinalCta({ authState }: { authState: MarketingAuthState }) {
  const href = authState.isAuthenticated ? "/dashboard" : "/community";
  const label = authState.isAuthenticated ? "Go to dashboard" : "Join early access";

  return (
    <section className="border-t border-border bg-accent/30">
      <Reveal className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-between gap-6 px-5 py-14 text-center sm:px-8 sm:py-16 lg:flex-row lg:text-left">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-foreground sm:text-3xl">
            Ready to connect the work to the payment?
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Every feature included during early access · No card required
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 min-w-[180px] rounded-lg text-sm font-semibold shadow-[0_12px_28px_-16px_hsl(var(--primary)/0.85)]">
            <Link href={href} data-cta="final_cta_primary">
              {label} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 min-w-[140px] rounded-lg text-sm hover:border-primary/40 hover:bg-primary/5"
          >
            <Link href="/talk" data-cta="final_cta_talk">
              Talk to us
            </Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
