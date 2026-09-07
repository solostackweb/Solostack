import type { Metadata } from "next";
import Link from "next/link";
import { Section, SectionHeading, SectionEyebrow, RuledColumns, RuledColumn } from "@/components/marketing/section";
import { siteConfig } from "@/config/site";
import { CreditCard, Smartphone, Banknote, Globe, Shield, Zap, BanknoteIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Payments · Stackivo Feature",
  description: "Get paid faster — UPI, Razorpay, Stripe, PayPal, bank transfer, manual. Multi-currency, FIRA/FIRC for exports, instant receipts.",
  alternates: { canonical: "/features/payments" },
  openGraph: {
    title: "Payments · Stackivo Feature",
    description: "Get paid faster — UPI, Razorpay, Stripe, PayPal, bank transfer, manual. Multi-currency, FIRA/FIRC for exports, instant receipts.",
    url: `${siteConfig.url}/features/payments`,
  },
};

const BENEFITS = [
  { icon: Smartphone, title: "UPI + Razorpay (India)", desc: "UPI intent, QR, Razorpay checkout (cards, netbanking, wallets). Auto-reconciliation via webhook." },
  { icon: Globe, title: "Stripe / PayPal / Wise (International)", desc: "Payment links for USD, EUR, GBP, etc. Client pays in their currency. FX rate locked at invoice date." },
  { icon: Banknote, title: "Bank transfer + manual", desc: "Account details on invoice. Mark paid manually when funds hit. Cash/cheque/other supported." },
  { icon: Shield, title: "FIRA/FIRC for exports", desc: "Auto-generate FIRA/FIRC for export payments. Required for RBI compliance and GST refund claims." },
  { icon: Zap, title: "Instant receipts", desc: "Auto-generated on payment. PDF with transaction ID, method, date. Sent to client + stored in portal." },
  { icon: Globe, title: "Multi-currency reconciliation", desc: "Invoice in USD → paid in USD → INR equivalent locked. FX gain/loss tracked per payment." },
];

const WORKFLOWS = [
  {
    title: "Domestic UPI/Razorpay",
    steps: ["Invoice sent with pay link", "Client clicks → Razorpay checkout", "Webhook auto-marks paid, receipt sent"],
  },
  {
    title: "International Stripe/PayPal",
    steps: ["Invoice in USD with pay link", "Client pays in their currency", "FX locked, FIRA generated for export"],
  },
  {
    title: "Manual/Bank transfer",
    steps: ["Client pays via bank/UPI", "You mark paid manually", "Receipt auto-generated, portal updated"],
  },
];

const FAQS = [
  {
    q: "Which payment gateways are supported?",
    a: "India: UPI (intent + QR), Razorpay (cards, netbanking, wallets). International: Stripe, PayPal, Wise payment links. Manual: bank transfer, cash, cheque, other.",
  },
  {
    q: "Does Stackivo charge a transaction fee?",
    a: "No. Stackivo passes through gateway fees (Razorpay ~2%, Stripe ~2.9%+$0.30). You can enable fee pass-through to add gateway fees as a line item on the invoice.",
  },
  {
    q: "How does auto-reconciliation work?",
    a: "Razorpay/Stripe webhooks automatically mark invoices paid when payment succeeds. Receipt PDF generated and emailed. Manual payments marked by you.",
  },
  {
    q: "What is FIRA/FIRC and do I need it?",
    a: "FIRA (Foreign Inward Remittance Advice) / FIRC (Foreign Inward Remittance Certificate) is required by RBI for export payments. Stackivo auto-generates it when an export invoice is paid via international gateway.",
  },
  {
    q: "Can I accept partial payments?",
    a: "Yes. Invoices support partial payments. Each payment creates a receipt. Invoice status updates to 'partially_paid' until fully paid.",
  },
];

export default function PaymentsFeaturePage() {
  return (
    <>
      <header className="mx-auto max-w-4xl px-5 sm:px-8 lg:px-10 pt-16 pb-12 sm:pt-20 sm:pb-16 text-center">
        <SectionEyebrow>Feature</SectionEyebrow>
        <h1 className="mt-4 mb-6 text-balance text-4xl font-display font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
          Payments
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
          Get paid faster — UPI, Razorpay, Stripe, PayPal, bank transfer, manual. Multi-currency, FIRA/FIRC for exports, instant receipts.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard/settings/payments" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Try it free
          </Link>
          <Link href="/compare" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-primary/5">
            Compare alternatives
          </Link>
        </div>
      </header>

      <Section size="default" id="benefits">
        <SectionHeading title="Why Stackivo payments" subtitle="Every way your clients pay, handled." />
        <RuledColumns cols={3}>
          {BENEFITS.map((b) => (
            <RuledColumn key={b.title} title={b.title} index={b.icon}>
              <p className="text-sm leading-7 text-muted-foreground">{b.desc}</p>
            </RuledColumn>
          ))}
        </RuledColumns>
      </Section>

      <Section size="default" id="workflows" className="bg-muted/30 rounded-2xl">
        <SectionHeading title="Real freelancer workflows" subtitle="From invoice sent to money in bank." />
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
          <h2 className="text-2xl font-display font-semibold tracking-tight sm:text-3xl">Ready to get paid faster?</h2>
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