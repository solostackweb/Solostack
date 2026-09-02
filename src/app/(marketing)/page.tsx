import type { Metadata } from "next";
import { Hero } from "@/components/marketing/home/hero";
import { TaxSection } from "@/components/marketing/home/tax-section";
import { FounderNote } from "@/components/marketing/founder-note";
import { ProductSection } from "@/components/marketing/home/product-section";
import { ConnectedWorkflowSection } from "@/components/marketing/home/connected-workflow-section";
import { AiSection } from "@/components/marketing/home/ai-section";
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

/** Calm Command homepage: connected product evidence before feature breadth. */
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
      <ProductSection />
      <ConnectedWorkflowSection />
      <TaxSection />
      <AiSection />
      <FounderNote />
      <FaqSection />
      <FinalCta authState={authState} />
    </>
  );
}
