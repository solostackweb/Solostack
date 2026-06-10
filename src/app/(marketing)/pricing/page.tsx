import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { PageHero } from "@/components/marketing/page-hero";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { PricingComparison } from "@/components/marketing/pricing-comparison";
import { FaqSection, type FaqItem } from "@/components/marketing/faq-section";
import { CtaBand } from "@/components/marketing/cta-band";
import { Reveal } from "@/components/marketing/motion";
import { GuaranteeStrip } from "@/components/marketing/guarantee-strip";
import { CompetitorComparison } from "@/components/marketing/competitor-comparison";
import { getMarketingAuthState } from "@/features/marketing/auth-state";
import { siteConfig } from "@/config/site";

const PRICING_FAQS: FaqItem[] = [
  {
    q: "What happens if I exceed 5 free clients?",
    a: "We never delete your data — but you won&rsquo;t be able to add a 6th client until you upgrade to Pro. Existing clients, invoices, and history stay accessible.",
  },
  {
    q: "Can I downgrade Pro → Free at any time?",
    a: "Yes. Your billing simply stops at the end of the current period. Your data isn&rsquo;t touched. If you have more than 5 clients, you can&rsquo;t add new ones until you go back to Pro, but everything stays accessible.",
  },
  {
    q: "Is GST input tax credit (ITC) available on subscription fees?",
    a: "Yes. Pro and Business invoices are GST-compliant tax invoices (with our GSTIN). Indian businesses registered under GST can claim ITC on subscription fees the same way as any other B2B service.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Razorpay handles checkout — UPI, all major credit/debit cards, net banking, and popular wallets. Razorpay subscription tokenisation means you don&rsquo;t enter card details again on renewal.",
  },
  {
    q: "Is there a 30-day money-back guarantee?",
    a: "Yes. If you&rsquo;re unhappy in the first 30 days, email support@stackivo.me and we&rsquo;ll process a full refund — no forms, no friction.",
  },
  {
    q: "Will my data be deleted if I cancel?",
    a: "No. We soft-delete your data on account closure and permanently delete it after a 30-day recovery window. You can export everything as JSON before that window closes.",
  },
  {
    q: "Do you offer a discount for students or beginners?",
    a: "If you&rsquo;re actively building a freelance practice and Pro pricing is genuinely tight, email support@stackivo.me with your situation. We&rsquo;ve never said no.",
  },
];

export const metadata: Metadata = {
  title: "Pricing for Freelancer Invoicing Software",
  description:
    "Simple Stackivo pricing for freelancer business management and GST invoicing in India. Start free, upgrade to Pro for unlimited clients and premium workflows.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Stackivo Pricing",
    description:
      "Free freelancer invoicing software with paid plans for unlimited clients, branding, client portal, and advanced reports.",
    url: `${siteConfig.url}/pricing`,
  },
};

export default async function PricingPage() {
  const authState = await getMarketingAuthState();

  return (
    <>
      <PageHero
        eyebrow="Simple, transparent pricing"
        title="Free forever for solo workers."
        subtitle="Start on the free plan, upgrade when you need unlimited clients or premium tooling. No credit card required."
      >
        <p className="text-xs font-medium text-muted-foreground/80">
          30-day money-back guarantee · GST-compliant invoices · Cancel anytime
        </p>
      </PageHero>

      <Section size="ultra">
        <PricingCards authState={authState} />
        <Reveal className="mt-10">
          <GuaranteeStrip />
        </Reveal>
      </Section>

      <Section size="ultra" className="border-y bg-muted/30">
        <Reveal>
          <SectionHeading title="Compare every plan" />
        </Reveal>
        <Reveal className="mx-auto mt-10 max-w-6xl">
          <PricingComparison />
        </Reveal>
      </Section>

      <Section size="ultra">
        <Reveal>
          <SectionHeading
            eyebrow="vs the alternatives"
            title="How Stackivo compares to other Indian invoicing tools."
            subtitle="Honest, conservative comparison. Verify each claim on their own site — these things change."
          />
        </Reveal>
        <Reveal className="mt-10">
          <CompetitorComparison />
        </Reveal>
      </Section>

      <FaqSection
        items={PRICING_FAQS}
        eyebrow="Pricing FAQ"
        title="Before you upgrade."
        subtitle="The questions every freelancer asks before going Pro. Anything else — open the chat."
      />
      <CtaBand authState={authState} />
    </>
  );
}
