import type { Metadata } from "next";
import { Hero } from "@/components/marketing/home/hero";
import { TrustStrip } from "@/components/marketing/home/trust-strip";
import { ProblemSection } from "@/components/marketing/home/problem-section";
import { ShowcaseSection } from "@/components/marketing/home/showcase-section";
import { CapabilitiesSection } from "@/components/marketing/home/capabilities-section";
import { InternationalSection } from "@/components/marketing/home/international-section";
import { AiSection } from "@/components/marketing/home/ai-section";
import { WorkflowSection } from "@/components/marketing/home/workflow-section";
import { Testimonials } from "@/components/marketing/home/testimonials";
import { PricingTeaser } from "@/components/marketing/home/pricing-teaser";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { FaqSection } from "@/components/marketing/faq-section";
import { DEFAULT_FAQS } from "@/components/marketing/faq-data";
import { getMarketingAuthState } from "@/features/marketing/auth-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Stackivo - Client work, invoices, contracts, and portals",
  description:
    "Stackivo is a SaaS workspace for freelancers and studios to manage clients, invoices, contracts, projects, time tracking, payments, client portals, and business insights.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Stackivo - Client work, invoices, contracts, and portals",
    description:
      "Stackivo is a SaaS workspace for freelancers and studios to manage clients, invoices, contracts, projects, time tracking, payments, client portals, and business insights.",
    url: siteConfig.url,
  },
};

/**
 * Homepage — a single story arc:
 *
 *   Hero (what it is) → Trust (who it's for) → Problem (the scattered stack)
 *   → Showcase (the product, interactive) → Capabilities (the details)
 *   → AI (the multiplier) → Workflow (hello-to-paid) → Testimonials (proof)
 *   → Pricing (the ask) → FAQ (objections) → Final CTA (the close).
 */
export default async function LandingPage() {
  const authState = await getMarketingAuthState();

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Stackivo",
            applicationCategory: "BusinessApplication",
            applicationSubCategory: "FreelanceManagement",
            operatingSystem: "Web",
            description: siteConfig.description,
            url: siteConfig.url,
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "INR",
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: DEFAULT_FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <Hero authState={authState} />
      <TrustStrip />
      <ProblemSection />
      <ShowcaseSection />
      <CapabilitiesSection />
      <InternationalSection />
      <AiSection />
      <WorkflowSection />
      <Testimonials />
      <PricingTeaser />
      <FaqSection />
      <FinalCta authState={authState} />
    </>
  );
}
