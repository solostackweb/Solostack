import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { FileText, Calculator, Globe, Repeat, Shield, Download, Zap, CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Invoicing · Stackivo Feature",
  description: "Professional invoices in seconds — GST-ready, multi-currency, recurring, and customizable. Built for Indian freelancers.",
  alternates: { canonical: "/features/invoicing" },
  openGraph: {
    title: "Invoicing · Stackivo Feature",
    description: "Professional invoices in seconds — GST-ready, multi-currency, recurring, and customizable. Built for Indian freelancers.",
    url: `${siteConfig.url}/features/invoicing`,
  },
};

const BENEFITS = [
  { icon: FileText, title: "One-click invoice creation", desc: "Clean visual editor. Line items, discounts, taxes auto-calculated. Duplicate, recurring, or from tracked time." },
  { icon: Calculator, title: "GST engine built-in", desc: "CGST/SGST/IGST auto-split by place of supply. GSTIN validation. HSN/SAC codes. Export invoices zero-rated under LUT." },
  { icon: Globe, title: "Multi-currency with locked FX", desc: "Invoice in USD, EUR, GBP, etc. FX rate locked at issue date. INR equivalent stored for accounting." },
  { icon: Repeat, title: "Recurring invoices", desc: "Weekly, monthly, quarterly, yearly. Auto-generates, auto-sends. Pro plan and up." },
  { icon: Zap, title: "Time → Invoice in one click", desc: "Unbilled hours → invoice with rates auto-applied. No copy-paste." },
  { icon: Download, title: "Professional PDF + public link", desc: "Branded PDF with your logo/colors. Public pay link with UPI, Razorpay, card, bank transfer." },
];

const WORKFLOWS = [
  {
    title: "Create → Send → Pay",
    steps: ["New invoice or from tracked time", "GST auto-calculated by client state", "Send via email + public pay link"],
  },
  {
    title: "Client pays",
    steps: ["Client opens link, chooses UPI/Card/NetBanking", "Razorpay handles payment", "Auto-marked paid, receipt generated"],
  },
  {
    title: "Recurring (Pro+)",
    steps: ["Set frequency, start date, end conditions", "Auto-generates on schedule", "Auto-sends if 'sent' status selected"],
  },
];

const FAQS = [
  {
    q: "Does Stackivo calculate GST automatically?",
    a: "Yes. Enter client's state and GSTIN — Stackivo determines place of supply and applies CGST/SGST (intra-state) or IGST (inter-state) automatically. Export invoices are zero-rated under LUT.",
  },
  {
    q: "Can I invoice in foreign currency?",
    a: "Yes. Choose any supported currency. FX rate is locked at issue date from a reliable source. INR equivalent is stored for your accounting and Pulse analytics.",
  },
  {
    q: "How do recurring invoices work?",
    a: "Pro/Business plans: set frequency (weekly/monthly/quarterly/yearly), start date, optional end date or max occurrences. Invoices auto-generate and can auto-send. You review before send if set to draft.",
  },
  {
    q: "Can I customize invoice branding?",
    a: "Pro/Business: custom logo, brand color, custom notes/terms, custom invoice prefix/padding. Free plan: Stackivo branding only.",
  },
  {
    q: "What payment methods are supported?",
    a: "UPI, Razorpay (cards, netbanking, wallets), bank transfer, manual (cash/cheque/other). International: Stripe, PayPal, Wise via payment links.",
  },
];

export default function InvoicingFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Invoicing
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Professional invoices in seconds — GST-ready, multi-currency, recurring, and customizable. Built for Indian freelancers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/invoices/new" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo invoicing" subtitle="GST done right. Multi-currency done right. Recurring done right." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From tracked time to paid invoice." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to invoice like a pro?</h2>
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