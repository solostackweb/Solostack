import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { getMarketingAuthState } from "@/features/marketing/auth-state";
import { siteConfig } from "@/config/site";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { GlobalCtaTracker } from "@/components/marketing/global-cta-tracker";
import { ExitIntentModal } from "@/components/marketing/exit-intent-modal";

/**
 * Public-website route group. Wraps every marketing page in a sticky header
 * + footer; auth + dashboard + onboarding live in their own route groups
 * with their own chrome.
 *
 * Marketing visitors reach support via the /contact form (which opens a
 * first-party guest ticket); the live chat widget is mounted only on the
 * authenticated dashboard.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authState = await getMarketingAuthState();

  // Site-wide structured data: Organization + WebSite. Helps search engines
  // and AI answer engines attribute and describe Stackivo correctly.
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: "Stackivo",
        url: siteConfig.url,
        logo: `${siteConfig.url}/icon.svg`,
        description: siteConfig.description,
        email: "support@stackivo.me",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Indore",
          addressRegion: "Madhya Pradesh",
          addressCountry: "IN",
        },
        sameAs: [siteConfig.links.twitter],
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        name: "Stackivo",
        url: siteConfig.url,
        publisher: { "@id": `${siteConfig.url}/#organization` },
        inLanguage: "en-IN",
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MarketingHeader authState={authState} />
      <main className="flex-1">{children}</main>
      <MarketingFooter authState={authState} />
      <StickyMobileCta authState={authState} />
      <GlobalCtaTracker />
      <ExitIntentModal />
    </div>
  );
}
