import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn, Paper } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { Users, Building2, Mail, Phone, Tag, Shield, FileText, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Client Management · Stackivo Feature",
  description: "Manage every client in one place — contact details, GSTIN, billing history, projects, contracts, and communication. Built for Indian freelancers.",
  alternates: { canonical: "/features/client-management" },
  openGraph: {
    title: "Client Management · Stackivo Feature",
    description: "Manage every client in one place — contact details, GSTIN, billing history, projects, contracts, and communication.",
    url: `${siteConfig.url}/features/client-management`,
  },
};

const BENEFITS = [
  { icon: Users, title: "Unified client profiles", desc: "Contact info, GSTIN, PAN, billing address, currency, locale, and notes in one place." },
  { icon: Tag, title: "GST-aware from day one", desc: "GSTIN validation, state code, GST registration status — used automatically for invoice tax calculation." },
  { icon: Building2, title: "Company + individual support", desc: "Track both the person and their business — separate fields for name, company, GSTIN, PAN." },
  { icon: FileText, title: "Complete history timeline", desc: "Every invoice, contract, proposal, project, payment, and message in one chronological feed." },
  { icon: Search, title: "Smart search & filters", desc: "Find clients by name, email, company, GSTIN, state, or custom tags in milliseconds." },
  { icon: Shield, title: "Row-level security", desc: "Each client belongs to you — RLS guarantees no other user can ever access your client data." },
];

const WORKFLOWS = [
  {
    title: "Lead → Client",
    steps: ["Capture via lead form or manual entry", "GSTIN auto-validated on save", "Auto-create from Ivo: 'Add client Acme Corp'"],
  },
  {
    title: "Client → Project",
    steps: ["Attach projects with milestones", "Track time per project", "Auto-generate invoices from tracked time"],
  },
  {
    title: "Client → Contract",
    steps: ["Pick client → contract pre-fills", "E-signature via public link", "Signed contract auto-attached to client"],
  },
];

const FAQS = [
  {
    q: "Can I import clients from CSV?",
    a: "Yes. Stackivo supports CSV import with columns for name, email, company, phone, GSTIN, address, and custom fields. Free plan includes import.",
  },
  {
    q: "Does Stackivo validate GSTIN automatically?",
    a: "Yes. When you enter a GSTIN, Stackivo validates the format, checksum, and state code in real-time. Invalid GSTINs are flagged before save.",
  },
  {
    q: "Can I track both individual freelancers and companies?",
    a: "Yes. Each client has separate fields for individual name, business name, GSTIN, PAN, and registration type (individual, proprietorship, LLP, private limited, etc.).",
  },
  {
    q: "Is there a client limit?",
    a: "Free plan: 5 clients lifetime. Pro and Business: unlimited clients.",
  },
];

export default function ClientManagementFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Client Management
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          One source of truth for every client — contact details, GST compliance, billing history, projects, contracts, and communication. Built for Indian freelancers from the ground up.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href="/dashboard/clients?create=1"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try it free
          </Link>
          <Link
            href="/compare"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5"
          >
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading
          title="Why Stackivo client management"
          subtitle="Not just a contact list — a freelancer's command center."
        />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn
              key={b.title}
              title={b.title}
              index={b.icon}
            >
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading
          title="Real freelancer workflows"
          subtitle="How client management connects to everything else."
        />
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
        <SectionHeading
          title="Common questions"
          subtitle="Factual answers."
        />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">
            Ready to manage clients properly?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Free forever for 5 clients. No card required.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start free
            </Link>
            <Link
              href="/compare/stackivo-vs-bonsai"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5"
            >
              Compare alternatives
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}