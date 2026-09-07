import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { Users, Shield, FileText, MessageSquare, CheckCheck, Globe, Zap, Settings } from "lucide-react";

export const metadata: Metadata = {
  title: "Client Portal · Stackivo Feature",
  description: "White-label client portal — documents, approvals, messages, files, meetings, and payments. Your brand, your domain.",
  alternates: { canonical: "/features/client-portal" },
  openGraph: {
    title: "Client Portal · Stackivo Feature",
    description: "White-label client portal — documents, approvals, messages, files, meetings, and payments. Your brand, your domain.",
    url: `${siteConfig.url}/features/client-portal`,
  },
};

const BENEFITS = [
  { icon: Users, title: "Dedicated client workspace", desc: "Each client gets their own portal — invoices, contracts, projects, files, messages, meetings in one place." },
  { icon: Shield, title: "Your brand, your domain (Business)", desc: "Custom domain (portal.yourdomain.com), logo, colors, favicon. Clients see your brand, not Stackivo." },
  { icon: FileText, title: "Documents with approvals", desc: "Upload deliverables → client approves or requests revisions. Version history. Audit trail." },
  { icon: MessageSquare, title: "Threaded communication", desc: "Contextual messages on documents, invoices, projects. Email notifications. No email ping-pong." },
  { icon: CheckCheck, title: "Client approvals on deliverables", desc: "Submit work → client approves or requests revision. Status: submitted → under review → approved." },
  { icon: Globe, title: "Meetings + calendar sync", desc: "Schedule meetings in portal. Google Calendar sync. Google Meet links auto-generated. Reminders sent." },
];

const WORKFLOWS = [
  {
    title: "Invite → Collaborate",
    steps: ["Create portal → invite client via email", "Client sets password → accesses workspace", "All past invoices/contracts auto-appear"],
  },
  {
    title: "Deliver → Approve",
    steps: ["Upload deliverable in project", "Client notified → reviews in portal", "Approves or requests revision with comments"],
  },
  {
    title: "Communicate → Decide",
    steps: ["Threaded messages on any document", "Email notifications for both parties", "Searchable history, no lost emails"],
  },
];

const FAQS = [
  {
    q: "Do clients need a Stackivo account?",
    a: "Clients create a simple password on first visit. No subscription, no dashboard — just a clean portal for your shared work.",
  },
  {
    q: "Can I use my own domain?",
    a: "Yes, on the Business plan. Configure portal.yourdomain.com with CNAME. Full white-label: your logo, colors, favicon, no Stackivo branding.",
  },
  {
    q: "Can clients pay invoices from the portal?",
    a: "Yes. Invoices show a 'Pay now' button with all enabled payment methods (UPI, Razorpay, Stripe, bank details).",
  },
  {
    q: "Can clients upload files?",
    a: "Yes. Clients can upload files to projects (design assets, briefs, assets). Size limits: Free 100MB, Pro 5GB, Business 50GB per portal.",
  },
  {
    q: "Is there a mobile app for clients?",
    a: "The portal is a PWA — works on mobile browsers, installable to home screen. Native mobile app is on the roadmap.",
  },
];

export default function ClientPortalFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Client Portal
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          White-label client portal — documents, approvals, messages, files, meetings, and payments. Your brand, your domain.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/portal" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo client portal" subtitle="Your client experience, your brand." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From invite to approved deliverable." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to wow your clients?</h2>
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