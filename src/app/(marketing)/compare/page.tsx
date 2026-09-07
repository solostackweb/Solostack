import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Compare Stackivo · Freelancer business OS alternatives",
  description: "Compare Stackivo vs Bonsai, HoneyBook, Clienter, Retainer, Zoho Books. Factual, feature-by-feature comparisons for Indian freelancers.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare Stackivo · Freelancer business OS alternatives",
    description: "Factual, feature-by-feature comparisons vs Bonsai, HoneyBook, Clienter, Retainer, Zoho Books.",
    url: `${siteConfig.url}/compare`,
  },
};

const COMPARISONS = [
  {
    slug: "stackivo-vs-bonsai",
    name: "Bonsai",
    tagline: "US-built freelancer toolkit for global solopreneurs",
    bestFor: "Global freelancers billing in USD",
    stackivoWins: "GST, INR, UPI, FIRA/FIRC, contracts included",
    href: "/compare/stackivo-vs-bonsai",
  },
  {
    slug: "stackivo-vs-honeybook",
    name: "HoneyBook",
    tagline: "US-built clientflow for creative professionals",
    bestFor: "US-based photographers, designers, event planners",
    stackivoWins: "GST, time→invoice, client approvals, India pricing",
    href: "/compare/stackivo-vs-honeybook",
  },
  {
    slug: "stackivo-vs-clienter",
    name: "Clienter",
    tagline: "Indian invoicing & client management",
    bestFor: "Indian freelancers who only need invoicing",
    stackivoWins: "Contracts, e-sign, projects, time, portal, analytics",
    href: "/compare/stackivo-vs-clienter",
  },
  {
    slug: "stackivo-vs-retainer",
    name: "Retainer",
    tagline: "Indian recurring/subscription billing",
    bestFor: "Indian freelancers with only recurring invoices",
    stackivoWins: "Contracts, e-sign, projects, time, portal, analytics",
    href: "/compare/stackivo-vs-retainer",
  },
  {
    slug: "stackivo-vs-zoho",
    name: "Zoho Books",
    tagline: "Indian accounting software for SMBs",
    bestFor: "Growing businesses with CA/accountant",
    stackivoWins: "Freelancer-first, contracts+e-sign included, time→invoice, lower price",
    href: "/compare/stackivo-vs-zoho",
  },
];

export default function CompareIndexPage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Compare Stackivo</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Compare Stackivo
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Factual, feature-by-feature comparisons vs the main alternatives Indian freelancers evaluate. No marketing fluff — just the differences that matter for your workflow.
        </p>
      </header>

      <Section size="default" id="comparisons">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={c.href}
              className="group relative rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  vs Stackivo
                </span>
              </div>
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-success-strong" />
                <span>Best for: {c.bestFor}</span>
              </div>
              <p className="mb-4 text-sm text-success-strong">
                Where Stackivo wins: {c.stackivoWins}
              </p>
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm font-medium text-primary group-hover:underline">
                  View comparison
                </span>
                <svg className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section size="default" className="bg-muted/30 rounded-2xl">
        <div className="mx-auto max-w-3xl text-center py-16 px-6">
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">
            How we compare
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-muted-foreground">
            Every comparison is factual, not promotional. We list features as they exist today — no marketing spin. Each page includes a verdict, summary tables, and FAQs with sources you can verify.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3 text-left">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Feature tables</h3>
              <p className="text-sm text-muted-foreground">Side-by-side with checkmarks, not vague claims.</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Verdict + summary</h3>
              <p className="text-sm text-muted-foreground">Where each wins, where they tie, and our take.</p>
            </div>
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">FAQs with sources</h3>
              <p className="text-sm text-muted-foreground">Answered factually, not defensively.</p>
            </div>
          </div>
        </div>
      </Section>

      <Section size="default">
        <SectionHeading
          title="Not seeing your alternative?"
          subtitle="We're adding more comparisons. Tell us what you're evaluating."
          align="center"
        />
        <div className="mt-8 text-center">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Request a comparison
          </Link>
        </div>
      </Section>
    </>
  );
}