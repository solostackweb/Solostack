import type { Metadata } from "next";
import { Hero } from "@/components/marketing/home/hero";
import { TaxSection } from "@/components/marketing/home/tax-section";
import { FounderNote } from "@/components/marketing/founder-note";
import { ProblemSection } from "@/components/marketing/home/problem-section";
import { ShowcaseSection } from "@/components/marketing/home/showcase-section";
import { CapabilitiesSection } from "@/components/marketing/home/capabilities-section";
import { AiSection } from "@/components/marketing/home/ai-section";
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
 * Homepage — eight sections, down from twelve (MASTER.md §8).
 *
 *   Hero (the artifact) → GST (the thing nobody else does) → Problem (the
 *   scattered stack) → Showcase (the product) → Capabilities (the details)
 *   → AI (the multiplier) → Founder note (who is behind it) → Pricing (the
 *   ask), then FAQ and the close.
 *
 * Cut in v2, and why:
 *   TrustStrip          — logo wall with no logos to put in it
 *   InternationalSection — an export invoice is a GST treatment, so it folds
 *                          into TaxSection rather than repeating the argument
 *   WorkflowSection     — restated what Showcase already demonstrates
 *   Testimonials        — no real customers yet, and invented proof is worse
 *                          than none. FounderNote takes the slot until there
 *                          are named names and real numbers.
 *
 * The rule that drove the cut: never two card grids in a row, and every
 * section earns its scroll.
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
      <TaxSection />
      <ProblemSection />
      <ShowcaseSection />
      <CapabilitiesSection />
      <AiSection />
      <FounderNote />
      <PricingTeaser />
      <FaqSection />
      <FinalCta authState={authState} />
    </>
  );
}
