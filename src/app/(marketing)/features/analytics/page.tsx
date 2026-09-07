import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { BarChart, TrendingUp, DollarSign, Clock, Target, Users, FileText, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Business Analytics (Pulse) · Stackivo Feature",
  description: "Real-time business analytics — revenue, profitability, client concentration, GST reports, project margins. Built for Indian freelancers.",
  alternates: { canonical: "/features/analytics" },
  openGraph: {
    title: "Business Analytics (Pulse) · Stackivo Feature",
    description: "Real-time business analytics — revenue, profitability, client concentration, GST reports, project margins. Built for Indian freelancers.",
    url: `${siteConfig.url}/features/analytics`,
  },
};

const BENEFITS = [
  { icon: DollarSign, title: "Revenue analytics", desc: "Collected vs. invoiced vs. overdue. Monthly/quarterly/yearly. INR + multi-currency with locked FX." },
  { icon: TrendingUp, title: "Project profitability", desc: "Revenue vs. time cost per project. Margin %, hours efficiency. Know which projects pay." },
  { icon: Users, title: "Client concentration", desc: "Top clients by revenue, invoice count, lifetime value. Identify dependency risk." },
  { icon: Clock, title: "Time analytics", desc: "Billable vs. non-billable hours. Utilization rate. Average rate. Projected vs. actual." },
  { icon: FileText, title: "GST reports", desc: "GSTR-1 ready CSV. B2B/B2C/Export breakdown. HSN/SAC summary. TDS summary. Ready for CA." },
  { icon: Download, title: "Export everything", desc: "CSV export for revenue, projects, clients, time entries, invoices. Bring your own BI." },
];

const WORKFLOWS = [
  {
    title: "Monthly review",
    steps: ["Open Pulse → Revenue tab", "Check collected vs. invoiced", "Drill into overdue clients"],
  },
  {
    title: "Project health check",
    steps: ["Projects → Profitability", "Sort by margin %", "Flag low-margin projects for repricing"],
  },
  {
    title: "Quarterly GST prep",
    steps: ["Pulse → GST Report", "Select quarter → Export CSV", "Send to CA or upload to portal"],
  },
];

const FAQS = [
  {
    q: "Is Pulse included in the Free plan?",
    a: "Yes. Free plan includes basic revenue analytics, project tracking, and client metrics. Advanced reports (GSTR-1 export, project profitability, client concentration) are Pro+.",
  },
  {
    q: "Can I export data for my own analysis?",
    a: "Yes. Every report has a CSV export button. You can export revenue, projects, clients, time entries, invoices, and payments for your own BI tools.",
  },
  {
    q: "Does Pulse handle multi-currency correctly?",
    a: "Yes. Revenue shown in INR (locked FX at invoice date) and original currency. FX gain/loss tracked separately. No hidden conversion errors.",
  },
  {
    q: "Can I see which clients are most profitable?",
    a: "Yes. Client concentration report shows revenue, invoice count, average value, and lifetime value per client. Sort by any column.",
  },
];

export default function AnalyticsFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Business Analytics (Pulse)
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Real-time business analytics — revenue, profitability, client concentration, GST reports, project margins. Built for Indian freelancers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/pulse" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo Pulse" subtitle="Your business, in numbers you can trust." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="Numbers that drive decisions." />
        <RuledColumns cols={3}>
          {WORKFLOWS.map((w, i) => (
            <RuledColumn key={w.title} index={String(i + 1)} title={w.title}>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {w.steps.map((step, si) => (
                  <li key={si} className="flex items-start gap-2">
                    <span className="shrink-0 text-primary font-mono text-xs">{String(si + 1)}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="faq">
        <dl className="space-y-8 max-w-3xl mx-auto">
          {FAQS.map((f, i) => (
            <div key={i} className="border-t border-border/40 pt-6">
              <dt className="font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section size="default" className="bg-primary/5 rounded-2xl border border-primary/20">
        <div className="mx-auto max-w-2xl text-center py-12 px-6">
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to understand your business?</h2>
          <p className="mt-4 text-muted-foreground">Free forever for 5 clients. No card required.</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">Start free</Link>
            <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">Compare alternatives</Link>
          </div>
        </div>
      </Section>
    </>
  );
}