import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { Shield, Calculator, Globe, FileText, CheckCheck, AlertTriangle, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "GST Compliance · Stackivo Feature",
  description: "GST-ready invoicing for Indian freelancers — CGST/SGST/IGST auto-split, GSTIN validation, place-of-supply logic, export invoices, GSTR-1 export.",
  alternates: { canonical: "/features/gst" },
  openGraph: {
    title: "GST Compliance · Stackivo Feature",
    description: "GST-ready invoicing for Indian freelancers — CGST/SGST/IGST auto-split, GSTIN validation, place-of-supply logic, export invoices, GSTR-1 export.",
    url: `${siteConfig.url}/features/gst`,
  },
};

const BENEFITS = [
  { icon: Calculator, title: "Auto CGST/SGST/IGST split", desc: "Place of supply determined from seller + client state. Intra-state = CGST+SGST. Inter-state = IGST. Zero manual work." },
  { icon: CheckCheck, title: "GSTIN validation & auto-fetch", desc: "Real-time format + checksum validation. State code extracted for place-of-supply. Invalid GSTINs flagged before save." },
  { icon: Globe, title: "Place-of-supply logic", desc: "Services: location of recipient. Goods: delivery location. Correct tax applied automatically for every invoice." },
  { icon: Globe, title: "Export invoices (zero-rated)", desc: "Foreign clients → zero-rated under LUT. No IGST. 'Export of services under LUT' footer auto-added. FX rate locked at issue date." },
  { icon: FileText, title: "GSTR-1 ready export", desc: "Invoice-level CSV mapped to GSTR-1 sections: B2B (GSTIN), B2C, Export. HSN/SAC summary. Ready for CA/portal upload." },
  { icon: AlertTriangle, title: "Composition scheme & TDS ready", desc: "Composition scheme flag on client. TDS section 194J tracking. TDS certificate details captured per invoice." },
];

const WORKFLOWS = [
  {
    title: "Domestic B2B invoice",
    steps: ["Enter client GSTIN → auto-validated", "Client state + your state → CGST/SGST or IGST", "HSN/SAC auto-suggested from history"],
  },
  {
    title: "Export invoice (LUT)",
    steps: ["Client marked as foreign → zero-rated", "Currency selected → FX rate locked", "Footer: 'Export of services under LUT'"],
  },
  {
    title: "GSTR-1 prep",
    steps: ["Invoices → GST Report → filter period", "B2B/B2C/Export tabs match GSTR-1", "Export CSV → upload to portal or send to CA"],
  },
];

const FAQS = [
  {
    q: "Does Stackivo file GSTR-1 automatically?",
    a: "No. Stackivo generates a GSTR-1 ready CSV that maps to the government portal sections. You (or your CA) upload it. Direct API filing is on the roadmap.",
  },
  {
    q: "How does place of supply work for services?",
    a: "For services, place of supply is the location of the recipient (client). Stackivo uses the client's state code (from GSTIN or manual entry) vs. your state to determine intra-state (CGST+SGST) or inter-state (IGST).",
  },
  {
    q: "Can I create export invoices without LUT?",
    a: "Yes. Without LUT, export services attract IGST (refundable later). Stackivo lets you choose: with LUT (zero-rated) or without (IGST applied). The footer note changes accordingly.",
  },
  {
    q: "Does Stackivo handle TDS (Section 194J)?",
    a: "Yes. You can mark an invoice as TDS-applicable. Stackivo captures TDS rate, certificate number, and deduction date. TDS summary report available for CA.",
  },
  {
    q: "What about composition scheme clients?",
    a: "Mark client as composition scheme. Stackivo applies correct tax treatment (no GST charged by you, client pays under composition). Flagged in GST report.",
  },
];

export default function GSTFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          GST Compliance
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          GST-ready invoicing for Indian freelancers — CGST/SGST/IGST auto-split, GSTIN validation, place-of-supply logic, export invoices, GSTR-1 export.
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
        <SectionHeading title="Why Stackivo GST" subtitle="India's tax complexity, handled." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From domestic B2B to export — GST handled." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready for GST without the headache?</h2>
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