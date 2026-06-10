import Link from "next/link";
import { StackivoMark } from "@/components/brand/stackivo-logo";
import { siteConfig } from "@/config/site";
import type { MarketingAuthState } from "@/features/marketing/types";
import { NewsletterForm } from "./newsletter-form";

const PRODUCT_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Stackivo AI", href: "/#ai" },
  { label: "How it works", href: "/#workflow" },
  { label: "GST invoicing", href: "/#gst" },
  { label: "Pricing", href: "/pricing" },
  { label: "Changelog", href: "/changelog" },
];

const TOOLS_LINKS = [
  { label: "Free tools overview", href: "/tools" },
  { label: "Hourly rate calculator", href: "/tools/freelance-rate-calculator" },
  { label: "GST calculator", href: "/tools/gst-calculator" },
  {
    label: "Late-payment calculator",
    href: "/tools/late-payment-interest-calculator",
  },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: "/docs" },
];

const COMPANY_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Talk to us", href: "/talk" },
  { label: "Security", href: "/security" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refund policy", href: "/refund-policy" },
];

export function MarketingFooter({
  authState,
}: {
  authState: MarketingAuthState;
}) {
  const columns = [
    { heading: "Product", links: PRODUCT_LINKS },
    { heading: "Resources", links: TOOLS_LINKS },
    { heading: "Company", links: COMPANY_LINKS },
  ];

  const bottomLinks = authState.isAuthenticated
    ? [{ label: "Dashboard", href: "/dashboard" }]
    : [
        { label: "Log in", href: "/login" },
        { label: "Start free", href: "/signup" },
        { label: "Client portal", href: "/portal-access" },
      ];

  return (
    <footer className="border-t bg-muted/20">
      <div className="mx-auto w-full max-w-[1600px] px-5 pb-8 pt-12 sm:px-8 sm:pt-14 lg:px-12 2xl:px-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
              <StackivoMark className="h-8 w-8" />
              <span className="text-base">{siteConfig.name}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Contracts, invoices, projects, time and payments — one clean
              workspace for freelancers and small studios.
            </p>
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Newsletter
              </p>
              <p className="text-xs text-muted-foreground">
                Monthly: what shipped, what&rsquo;s next, India freelancing tips.
              </p>
              <NewsletterForm
                source="footer"
                ctaLabel="Subscribe"
                successLabel="Subscribed."
                compact
              />
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.heading} className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={`${col.heading}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border/70 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. Built for independent professionals.
          </p>
          <div className="flex items-center gap-4">
            {bottomLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <span className="font-medium">Made in India · For the world</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
