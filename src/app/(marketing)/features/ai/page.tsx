import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { Bot, Sparkles, Zap, Shield, Brain, MessageSquare, Clock, ZapIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Ivo AI Assistant · Stackivo Feature",
  description: "Your freelance business copilot — create invoices, contracts, proposals, track time, manage clients, and get answers. Works inside Stackivo.",
  alternates: { canonical: "/features/ai" },
  openGraph: {
    title: "Ivo AI Assistant · Stackivo Feature",
    description: "Your freelance business copilot — create invoices, contracts, proposals, track time, manage clients, and get answers. Works inside Stackivo.",
    url: `${siteConfig.url}/features/ai`,
  },
};

const BENEFITS = [
  { icon: Sparkles, title: "Natural language → structured docs", desc: "Say 'Create invoice for Acme Corp for 20 hours at ₹5000/hr' → Ivo drafts it with GST, line items, and client details filled." },
  { icon: Zap, title: "Full workflow automation", desc: "Create invoices, contracts, proposals, clients, projects, time entries, meetings — all through chat. No forms to hunt for." },
  { icon: Brain, title: "Context-aware answers", desc: "Ask 'Who owes me money?' → Ivo reads your actual invoices. 'What's my avg project margin?' → calculates from real data." },
  { icon: Shield, title: "Privacy-first, no training on your data", desc: "Your data never leaves your workspace. Ivo uses Groq for inference only — no training, no retention beyond session." },
  { icon: MessageSquare, title: "Drafting support (not just facts)", desc: "Payment reminders, proposal follow-ups, client emails, contract clauses — Ivo writes, you approve." },
  { icon: Clock, title: "Proactive nudges", desc: "Ivo surfaces overdue invoices, unbilled time, expiring contracts, quiet proposals — and offers one-click action." },
];

const WORKFLOWS = [
  {
    title: "Create invoice in 30 seconds",
    steps: ["Type: 'Invoice Acme Corp for 15h at ₹6000/hr'", "Ivo: confirms client, shows draft with GST", "Click 'Send' → done"],
  },
  {
    title: "Get paid insights",
    steps: ["Ask: 'Who hasn't paid this month?'", "Ivo: lists overdue invoices with amounts", "Click 'Send reminders' → Ivo drafts emails"],
  },
  {
    title: "Draft contract from chat",
    steps: ["Say: 'NDA for new client Beta Ltd'", "Ivo: picks template, fills client/project", "Review → send for e-signature"],
  },
];

const FAQS = [
  {
    q: "Is my data used to train AI models?",
    a: "No. Your data never leaves your Stackivo workspace. Ivo uses Groq for inference only — no training, no retention beyond the conversation session. Your invoices, clients, contracts stay private.",
  },
  {
    q: "What can Ivo actually do vs. just answer?",
    a: "Ivo can CREATE: invoices, contracts, proposals, clients, projects, time entries, meetings, questionnaires. It can READ: invoices, clients, projects, time, revenue. It can DRAFT: emails, reminders, contract clauses. It CANNOT: send money, delete data, or act without your explicit approval.",
  },
  {
    q: "Does Ivo work on mobile?",
    a: "Yes. The Ivo panel works on mobile web and PWA. Voice input is on the roadmap. All creation workflows (pickers, confirmations) are touch-optimized.",
  },
  {
    q: "What AI model does Ivo use?",
    a: "Ivo uses Groq-hosted open-weight models (currently GPT-OSS 120B) for fast, structured inference. Local rule-based fallbacks work offline for core workflows.",
  },
  {
    q: "Is there a usage limit?",
    a: "Free plan: 20 AI messages/month. Pro: 100/month. Business: 500/month. Local fallbacks (invoice draft, contract template) don't count against limits.",
  },
];

export default function AIFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Ivo AI Assistant
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Your freelance business copilot — create invoices, contracts, proposals, track time, manage clients, and get answers. Works inside Stackivo.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Ivo" subtitle="Not a chatbot. A copilot that does the work." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From 'create invoice' to done in seconds." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready for a copilot that actually works?</h2>
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