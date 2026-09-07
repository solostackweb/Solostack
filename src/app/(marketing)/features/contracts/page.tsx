import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { FileText, PenTool, Shield, Users, Clock, Mail, CheckCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Contracts & E-Signature · Stackivo Feature",
  description: "Create, send, and e-sign contracts legally in India. Freelancer-specific templates, public signing links, and contract-to-invoice workflow.",
  alternates: { canonical: "/features/contracts" },
  openGraph: {
    title: "Contracts & E-Signature · Stackivo Feature",
    description: "Create, send, and e-sign contracts legally in India. Freelancer-specific templates, public signing links, and contract-to-invoice workflow.",
    url: `${siteConfig.url}/features/contracts`,
  },
};

const BENEFITS = [
  { icon: FileText, title: "Freelancer-specific templates", desc: "MSA, SOW, NDA, retainer, fixed-price, hourly — written for Indian freelancers, not generic legalese." },
  { icon: PenTool, title: "Visual editor with variables", desc: "Rich-text editor with client/project merge fields ({{client.name}}, {{project.rate}}, {{milestone.due}}). Live preview." },
  { icon: Shield, title: "Legally valid e-signature (India)", desc: "IT Act 2000 compliant. Draw, type, or upload signature. Audit trail with IP, timestamp, device info." },
  { icon: Users, title: "Multi-party signing", desc: "Sequential or parallel signing. Client signs first, you countersign, or both sign independently." },
  { icon: Clock, title: "Public signing links", desc: "No login required for clients. One-click link works on mobile. Real-time status: sent → viewed → signed." },
  { icon: CheckCheck, title: "Contract → Invoice", desc: "Signed contract auto-generates invoice per milestones or schedule. No manual re-entry." },
];

const WORKFLOWS = [
  {
    title: "Create → Send → Sign",
    steps: ["Pick template or start blank", "Merge fields auto-fill from client/project", "Send via public link (no login for client)"],
  },
  {
    title: "Client signs",
    steps: ["Client opens link on any device", "Draw/type/upload signature", "Audit trail: IP, timestamp, device recorded"],
  },
  {
    title: "Signed → Invoice",
    steps: ["Contract status → Signed", "Milestones auto-generate invoices", "Or manual: one-click 'Create invoice from contract'"],
  },
];

const FAQS = [
  {
    q: "Are e-signatures legally valid in India?",
    a: "Yes. Stackivo's e-signature complies with the Information Technology Act, 2000. The audit trail (IP, timestamp, device, signature image) provides admissible evidence under Section 65B of the Indian Evidence Act.",
  },
  {
    q: "Can I upload my own contract template?",
    a: "Yes. You can create custom templates in the visual editor, save them, and reuse. Templates support merge fields for client, project, and custom variables.",
  },
  {
    q: "Does the client need a Stackivo account to sign?",
    a: "No. Public signing links work without login. The client opens the link, reviews, signs, and submits — all in the browser.",
  },
  {
    q: "Can I require multiple signers?",
    a: "Yes. You can set sequential or parallel signing order. Each signer gets their own link and audit trail entry.",
  },
  {
    q: "What happens after a contract is signed?",
    a: "The signed PDF is stored with audit trail. You can auto-generate invoices from contract milestones or create invoices manually with one click.",
  },
];

export default function ContractsFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Contracts & E-Signature
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Create, send, and e-sign contracts legally in India. Freelancer-specific templates, public signing links, and contract-to-invoice workflow.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/contracts?create=1" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo contracts" subtitle="Built for freelancers, not lawyers." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From template to signed contract to invoice." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to send contracts that get signed?</h2>
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