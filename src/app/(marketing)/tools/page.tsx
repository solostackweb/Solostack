import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, FileText, Clock, Sparkles } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { Reveal, StaggerItem, StaggerReveal } from "@/components/marketing/motion";
import { TOOLS, type ToolMeta } from "@/features/tools/types";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Free freelancer tools · Stackivo",
  description:
    "Free calculators for Indian freelancers — set your hourly rate, compute GST, and claim interest on overdue invoices. Built by Stackivo.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free freelancer tools by Stackivo",
    description:
      "Free calculators for Indian freelancers: hourly rate, GST, late-payment interest.",
    url: `${siteConfig.url}/tools`,
  },
};

export const dynamic = "force-static";

const ICONS = {
  Calculator,
  FileText,
  Clock,
} as const;

export default function ToolsIndexPage() {
  return (
    <>
      <PageHero
        eyebrow="Free tools"
        title="Tiny calculators that pay for themselves."
        subtitle="Three free calculators that solve real problems Indian freelancers run into every week. No signup, no email gate."
      >
        <p className="text-xs font-medium text-muted-foreground/80">
          100% free · No account needed · Works on mobile
        </p>
      </PageHero>

      <Section size="ultra">
        <StaggerReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => (
            <StaggerItem key={t.slug} className="h-full">
              <ToolCard tool={t} />
            </StaggerItem>
          ))}
        </StaggerReveal>

        {/* Product cross-sell */}
        <Reveal className="mt-8">
          <div className="flex flex-col items-center justify-between gap-5 rounded-3xl border border-primary/15 bg-primary/[0.03] px-7 py-8 text-center lg:flex-row lg:text-left">
            <div className="flex items-start gap-4">
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-foreground">
                  These calculators live inside Stackivo too.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Rates flow into projects, GST into invoices, and overdue interest
                  into payment reminders — automatically.
                </p>
              </div>
            </div>
            <Link
              href="/signup"
              data-cta="tools_index_signup"
              className="btn-gradient inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-0 px-6 text-sm font-semibold text-primary-foreground"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>

        <Reveal>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Want a calculator that doesn&rsquo;t exist yet?{" "}
            <Link
              href="/contact"
              className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
            >
              Tell us
            </Link>{" "}
            &mdash; we ship the most-requested ones first.
          </p>
        </Reveal>
      </Section>
    </>
  );
}

function ToolCard({ tool }: { tool: ToolMeta }) {
  const Icon = ICONS[tool.icon];
  return (
    <Link
      href={`/tools/${tool.slug}`}
      data-cta={`tools_index_${tool.slug}`}
      className="group flex h-full flex-col rounded-3xl border bg-card p-7 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
        {tool.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {tool.helps}
      </p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        Open calculator
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
