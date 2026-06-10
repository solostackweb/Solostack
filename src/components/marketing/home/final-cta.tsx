import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MarketingAuthState } from "@/features/marketing/types";
import { Reveal } from "../motion";

/**
 * Slim closing CTA — one line, one button, on the normal light background.
 */
export function FinalCta({ authState }: { authState: MarketingAuthState }) {
  const href = authState.isAuthenticated ? "/dashboard" : "/signup";
  const label = authState.isAuthenticated ? "Go to dashboard" : "Start free";

  return (
    <section className="border-t bg-muted/30">
      <Reveal className="mx-auto flex w-full max-w-[1600px] flex-col items-center justify-between gap-5 px-5 py-10 text-center sm:px-8 sm:py-12 lg:flex-row lg:px-12 lg:text-left 2xl:px-16">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
            Ready to get your client work together?
          </h2>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Free for your first 5 clients · No card required · 2-minute setup
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="btn-gradient h-12 min-w-[180px] rounded-full border-0 text-[15px] font-semibold">
            <Link href={href} data-cta="final_cta_primary">
              {label} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 min-w-[140px] rounded-full text-[15px] hover:border-primary/40 hover:bg-primary/5"
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
