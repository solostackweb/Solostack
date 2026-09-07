import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ComparisonHero, ComparisonTable, ComparisonSummary, ComparisonVerdict, FAQSchema } from "@/components/marketing/comparison-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Stackivo vs Zoho Books · Freelancer business OS comparison",
  description: "Compare Stackivo and Zoho Books for freelancer management. Stackivo is India-first freelancer OS with GST, contracts, projects, time tracking, and client portals. Zoho Books is accounting software for SMBs.",
  alternates: { canonical: "/compare/stackivo-vs-zoho" },
  openGraph: {
    title: "Stackivo vs Zoho Books · Freelancer business OS comparison",
    description: "Compare Stackivo and Zoho Books for freelancer management. Stackivo is India-first freelancer OS with GST, contracts, projects, time tracking, and client portals.",
    url: `${siteConfig.url}/compare/stackivo-vs-zoho`,
  },
};

const COMPETITOR = "Zoho Books";
const COMPETITOR_TAGLINE = "Indian accounting software for SMBs — invoicing, inventory, banking, and GST compliance.";
const COMPETITOR_WEBSITE = "https://www.zoho.com/books/";

const ROWS = [
  { category: "Core positioning" },
  { feature: "Built for freelancers (vs SMBs/accountants)", stackivo: true, competitor: false },
  { feature: "Built for Indian market (GST, INR)", stackivo: true, competitor: true },
  { feature: "All-in-one freelancer OS (CRM + projects + finance)", stackivo: true, competitor: false },
  { category: "GST & Invoicing" },
  { feature: "GST-ready invoicing (CGST/SGST/IGST split)", stackivo: true, competitor: true },
  { feature: "GSTIN validation & auto-fetch", stackivo: true, competitor: true },
  { feature: "Place-of-supply logic (inter vs intra state)", stackivo: true, competitor: true },
  { feature: "Export invoices (zero-rated under LUT)", stackivo: true, competitor: true },
  { feature: "Recurring invoices", stackivo: "Pro", competitor: "Higher tier" },
  { feature: "Custom branding on invoices", stackivo: "Pro", competitor: true },
  { feature: "Multi-currency with locked FX rates", stackivo: true, competitor: true },
  { category: "Contracts & E-signature" },
  { feature: "Contract templates (freelancer-specific)", stackivo: true, competitor: false },
  { feature: "E-signature (legally valid in India)", stackivo: "Pro", competitor: "Separate app (Zoho Sign)" },
  { feature: "Contract → invoice workflow", stackivo: true, competitor: false },
  { feature: "Public signing links", stackivo: true, competitor: false },
  { category: "Projects & Time" },
  { feature: "Project workspaces with milestones", stackivo: true, competitor: "Add-on (Zoho Projects)" },
  { feature: "Time tracking → invoice", stackivo: true, competitor: "Separate app (Zoho Projects)" },
  { feature: "Billable rates per project/task", stackivo: true, competitor: "Add-on (Zoho Projects)" },
  { feature: "Time reports & exports", stackivo: true, competitor: "Add-on (Zoho Projects)" },
  { category: "Client Portal" },
  { feature: "Client portal (documents, updates, files)", stackivo: "Pro", competitor: "Higher tier" },
  { feature: "Custom portal branding", stackivo: "Business", competitor: false },
  { feature: "Client approvals on deliverables", stackivo: true, competitor: false },
  { category: "Payments & Banking" },
  { feature: "UPI / Razorpay integration", stackivo: true, competitor: true },
  { feature: "Stripe / PayPal integration", stackivo: true, competitor: true },
  { feature: "Bank transfer / manual payment tracking", stackivo: true, competitor: true },
  { feature: "FIRA/FIRC for export payments", stackivo: true, competitor: false },
  { category: "Accounting & Compliance" },
  { feature: "Double-entry accounting", stackivo: false, competitor: true },
  { feature: "GSTR-1/3B auto-preparation", stackivo: "Export only", competitor: true },
  { feature: "TDS compliance", stackivo: "Manual", competitor: true },
  { feature: "CA/Accountant collaboration", stackivo: "Export", competitor: "Built-in" },
  { category: "Pricing & Limits" },
  { feature: "Free forever plan", stackivo: "5 clients", competitor: "No (14-day trial)" },
  { feature: "Starting price (monthly)", stackivo: "₹499/mo", competitor: "₹749/mo (Standard)" },
  { feature: "Client limit on paid plans", stackivo: "Unlimited", competitor: "500 contacts (Standard)" },
  { feature: "Team/collaborator seats", stackivo: "Business", competitor: "Add-on" },
];

const SUMMARY = {
  stackivoWins: [
    "Freelancer-first: contracts, projects, time, portal in one app",
    "E-signature included in Pro (Zoho Sign is separate paid app)",
    "Time tracking → invoice workflow built-in",
    "Client portal with approvals on Pro",
    "Free forever plan (5 clients)",
    "Lower starting price for freelancers (₹499 vs ₹749)",
    "Simpler UI — no accounting jargon",
  ],
  competitorWins: [
    "Full double-entry accounting (GSTR-1/3B, TDS, balance sheet)",
    "CA/Accountant collaboration built-in",
    "Inventory management",
    "Deeper banking integrations (auto-reconciliation)",
    "More mature ecosystem (40+ Zoho apps)",
  ],
  neutral: [
    "Both India-first with full GST support",
    "Both support multi-currency, Razorpay, UPI",
    "Both have recurring invoices on paid plans",
  ],
};

const VERDICT = "Zoho Books is excellent accounting software for SMBs with a CA — double-entry, GSTR filing, inventory, TDS. It's not built for freelancers: contracts, e-signature, time tracking, and client portal require separate Zoho apps (Sign, Projects, etc.) at extra cost. Stackivo is a freelancer business OS: contracts, e-signature, projects, time tracking, client portal, and analytics are all native in one app. If you need accounting for a growing business with a CA, use Zoho Books. If you're a freelancer who needs to manage clients, contracts, projects, time, and invoices in one place — Stackivo is purpose-built for you.";

const FACTUAL_FAQS = [
  {
    q: "Can I use Zoho Books for freelancer contracts and e-signature?",
    a: "Zoho Books does not have built-in contract templates or e-signature. You would need Zoho Sign (separate paid app) for e-signature, and there's no contract-to-invoice workflow.",
  },
  {
    q: "Does Zoho Books have time tracking that creates invoices?",
    a: "No. Time tracking requires Zoho Projects (separate paid app). There's no native time-to-invoice conversion in Zoho Books.",
  },
  {
    q: "Does Zoho Books have a client portal?",
    a: "Zoho Books has a client portal on higher-tier plans, but it's focused on invoice viewing and payment — not project updates, deliverable approvals, or document collaboration like Stackivo's portal.",
  },
  {
    q: "Is Zoho Books cheaper than Stackivo?",
    a: "No. Zoho Books Standard starts at ₹749/mo with contact limits (500). Stackivo Pro is ₹499/mo with unlimited clients and includes contracts, e-signature, projects, time tracking, and client portal — features that require separate Zoho apps.",
  },
  {
    q: "Can I use Stackivo alongside Zoho Books for accounting?",
    a: "Yes. Many freelancers use Stackivo for client-facing work (contracts, projects, invoices, portal) and export invoice data to Zoho Books or their CA for accounting/GSTR filing.",
  },
  {
    q: "Can I import data from Zoho Books to Stackivo?",
    a: "Stackivo supports CSV import for clients. For invoices and other records, we recommend exporting from Zoho Books and recreating key records in Stackivo for accuracy.",
  },
];

export default function ZohoComparisonPage() {
  return (
    <>
      <FAQSchema faqs={FACTUAL_FAQS} />
      <ComparisonHero
        competitorName={COMPETITOR}
        competitorTagline={COMPETITOR_TAGLINE}
        competitorWebsite={COMPETITOR_WEBSITE}
      />
      <Section size="default" id="comparison">
        <ComparisonTable rows={ROWS} competitorName={COMPETITOR} />
      </Section>
      <Section size="default" id="summary">
        <ComparisonSummary
          stackivoWins={SUMMARY.stackivoWins}
          competitorWins={SUMMARY.competitorWins}
          neutral={SUMMARY.neutral}
        />
      </Section>
      <Section size="default" id="verdict">
        <ComparisonVerdict verdict={VERDICT} />
      </Section>
      <Section size="default" id="faq" className="py-16">
        <SectionHeading
          title="Common questions"
          subtitle="Factual answers to help you decide."
        />
        <dl className="space-y-8 max-w-3xl mx-auto">
          {FACTUAL_FAQS.map((f, i) => (
            <div key={i} className="border-t border-border/40 pt-6">
              <dt className="font-semibold text-foreground">{f.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}