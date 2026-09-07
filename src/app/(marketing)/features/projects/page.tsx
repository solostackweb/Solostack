import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { FolderKanban, Target, Clock, TrendingUp, Flag, Users, Calculator, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Project Management · Stackivo Feature",
  description: "Manage projects from proposal to payment — milestones, time tracking, billable rates, and profitability. Built for Indian freelancers.",
  alternates: { canonical: "/features/projects" },
  openGraph: {
    title: "Project Management · Stackivo Feature",
    description: "Manage projects from proposal to payment — milestones, time tracking, billable rates, and profitability.",
    url: `${siteConfig.url}/features/projects`,
  },
};

const BENEFITS = [
  { icon: FolderKanban, title: "Project workspaces", desc: "Each project gets its own space — milestones, files, time entries, contracts, and invoices in one view." },
  { icon: Target, title: "Milestone tracking", desc: "Define milestones with due dates, link to invoices, and track progress visually." },
  { icon: Clock, title: "Time tracking → invoice", desc: "Start/stop timer or manual entry. Billable hours auto-convert to invoice lines with rates." },
  { icon: Calculator, title: "Billable rates per project/task", desc: "Set hourly or fixed rates per project, task, or client. Override per time entry if needed." },
  { icon: TrendingUp, title: "Profitability at a glance", desc: "Revenue vs. time cost per project. Know which projects pay well and which don't." },
  { icon: Flag, title: "Status workflow", desc: "Lead → Planning → Active → On Hold → Completed → Archived. Custom statuses supported." },
];

const WORKFLOWS = [
  {
    title: "Proposal → Project",
    steps: ["Win proposal → auto-create project", "Milestones auto-generated from proposal", "Client portal access granted instantly"],
  },
  {
    title: "Active Project",
    steps: ["Track time against milestones", "Billable hours auto-queue for invoice", "Client sees progress in portal"],
  },
  {
    title: "Project → Invoice",
    steps: ["Unbilled time → one-click invoice", "Milestone completion → auto-invoice", "Revenue vs. cost tracked automatically"],
  },
];

const FAQS = [
  {
    q: "Can I track time without a project?",
    a: "Yes. Time entries can be standalone or linked to a project. Standalone entries can be invoiced directly or later assigned to a project.",
  },
  {
    q: "Can I set different rates for different tasks?",
    a: "Yes. Each time entry can have its own rate, or inherit the project default. You can also set client-specific rate cards.",
  },
  {
    q: "Can I see project profitability in real-time?",
    a: "Yes. The project dashboard shows revenue (invoiced + paid), time cost (hours × your internal rate), and margin — updated live.",
  },
  {
    q: "Can clients see project progress?",
    a: "Yes. The client portal shows milestones, time spent, deliverables, and allows approvals on submitted work.",
  },
];

export default function ProjectsFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Project Management
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          From proposal to payment — milestones, time tracking, billable rates, and profitability in one workspace. Built for Indian freelancers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/projects?create=1" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo project management" subtitle="Not just tasks — the full freelancer lifecycle." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="How projects connect to contracts, time, and invoices." />
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
        <SectionHeading title="Common questions" subtitle="Factual answers." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to manage projects properly?</h2>
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