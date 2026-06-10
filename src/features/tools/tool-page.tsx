import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal } from "@/components/marketing/motion";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/marketing/newsletter-form";

/**
 * Shared chrome for a /tools/<slug> page.
 *
 * Calculators consist of three vertically-stacked sections:
 *   - `<ToolHero/>`   — eyebrow / title / tagline (server-rendered)
 *   - `<ToolBody/>`   — the actual calculator UI (client component)
 *   - `<ToolFooter/>` — CTA to start free + newsletter capture (server)
 *
 * All three are pinned by the parent page; this file is just helpers
 * + the closing CTA component.
 */

interface ToolHeroProps {
  eyebrow?: string;
  title: string;
  tagline: string;
}

export function ToolHero({ eyebrow, title, tagline }: ToolHeroProps) {
  return (
    <PageHero
      eyebrow={eyebrow ? `Free tool · ${eyebrow}` : "Free tool"}
      title={title}
      subtitle={tagline}
    />
  );
}

/**
 * Closing CTA shown after every calculator.
 *
 * Two complementary actions:
 *  - Primary: "Continue inside Stackivo" → /signup (the high-intent
 *    visitor who just got value from the tool is the best signup
 *    moment we have).
 *  - Secondary: newsletter capture for the visitor who isn't ready
 *    to sign up but wants to stay in touch.
 */
export function ToolFooter({
  toolSlug,
  ctaHeadline = "Use Stackivo to do the rest.",
  ctaSubheadline = "Stackivo invoices your clients, tracks payments, and reminds you when something's overdue — automatically.",
}: {
  toolSlug: string;
  ctaHeadline?: string;
  ctaSubheadline?: string;
}) {
  return (
    <>
      <Section size="default" className="pb-10 pt-12 sm:pt-14">
        <Reveal>
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-10">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
              {ctaHeadline}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              {ctaSubheadline}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11">
                <Link href="/signup" data-cta={`tool_${toolSlug}_signup`}>
                  Start free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-11">
                <Link href="/pricing" data-cta={`tool_${toolSlug}_pricing`}>
                  See pricing
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Section>

      <Section size="default" className="pb-20">
        <Reveal>
          <div className="mx-auto max-w-xl rounded-xl border bg-muted/20 p-6 text-center">
            <p className="text-sm font-medium">
              Get one practical India-freelancer tip a month.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pricing benchmarks, GST changes, contract templates. No spam.
            </p>
            <div className="mt-4 flex justify-center">
              <NewsletterForm
                source={`tool_${toolSlug}`}
                ctaLabel="Subscribe"
                successLabel="Subscribed. Talk soon."
              />
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Inline result CTA — rendered inside the calculator itself after a result
// is computed. Client-compatible (no server imports).
// ---------------------------------------------------------------------------

/**
 * A compact action strip shown immediately after the calculator result.
 * `resultLine` should be the key number from the calculation, e.g.
 * "Total invoice: ₹11,800" — it appears in the CTA copy to make it
 * feel contextual and immediate.
 */
export function ToolInlineCta({
  resultLine,
  ctaText,
  href = "/signup",
}: {
  resultLine: string;
  ctaText: string;
  href?: string;
}) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <Zap className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{resultLine}</span>
          {" — "}
          {ctaText}
        </p>
      </div>
      <Button asChild size="sm" className="shrink-0 gap-1.5 whitespace-nowrap">
        <Link href={href}>
          Send invoice free <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
