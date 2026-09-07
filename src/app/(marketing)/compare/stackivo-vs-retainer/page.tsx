import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ComparisonHero, ComparisonTable, ComparisonSummary, ComparisonVerdict, FAQSchema } from "@/components/marketing/comparison-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Stackivo vs Retainer · Freelancer business OS comparison",
  description: "Compare Stackivo and Retainer for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals. Retainer is a simpler Indian invoicing tool.",
  alternates: { canonical: "/compare/stackivo-vs-retainer" },
  openGraph: {
    title: "Stackivo vs Retainer · Freelancer business OS comparison",
    description: "Compare Stackivo and Retainer for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals.",
    url: `${siteConfig.url}/compare/stackivo-vs-retainer`,
  },
};

const COMPETITOR = "Retainer";
const COMPETITOR_TAGLINE = "Indian invoicing tool focused on recurring billing and subscription management for freelancers.";
const COMPETITOR_WEBSITE = "https://retainer.in";

const ROWS = [
  { category: "Core positioning" },
  { feature: "Built for Indian freelancers (GST, INR, India support)", stackivo: true, competitor: true },
  { feature: "All-in-one workspace (CRM + projects + finance)", stackivo: true, competitor: false },
  { feature: "Freelancer-first (vs SMB/retail)", stackivo: true, competitor: true },
  { category: "GST & Invoicing" },
  { feature: "GST-ready invoicing (CGST/SGST/IGST split)", stackivo: true, competitor: true },
  { feature: "GSTIN validation & auto-fetch", stackivo: true, competitor: true },
  { feature: "Place-of-supply logic (inter vs intra state)", stackivo: true, competitor: true },
  { feature: "Export invoices (zero-rated under LUT)", stackivo: true, competitor: false },
  { feature: "Recurring invoices", stackivo: "Pro", competitor: true },
  { feature: "Custom branding on invoices", stackivo: "Pro", competitor: false },
  { feature: "Multi-currency with locked FX rates", stackivo: true, competitor: false },
  { category: "Contracts & E-signature" },
  { feature: "Contract templates (freelancer-specific)", stackivo: true, competitor: false },
  { feature: "E-signature (legally valid in India)", stackivo: "Pro", competitor: false },
  { feature: "Contract → invoice workflow", stackivo: true, competitor: false },
  { feature: "Public signing links", stackivo: true, competitor: false },
  { category: "Projects & Time" },
  { feature: "Project workspaces with milestones", stackivo: true, competitor: false },
  { feature: "Time tracking → invoice", stackivo: true, competitor: false },
  { feature: "Billable rates per project/task", stackivo: true, competitor: false },
  { feature: "Time reports & exports", stackivo: true, competitor: false },
  { category: "Client Portal" },
  { feature: "Client portal (documents, updates, files)", stackivo: "Pro", competitor: false },
  { feature: "Custom portal branding", stackivo: "Business", competitor: false },
  { feature: "Client approvals on deliverables", stackivo: true, competitor: false },
  { category: "Payments & Banking" },
  { feature: "UPI / Razorpay integration", stackivo: true, competitor: true },
  { feature: "Stripe / PayPal integration", stackivo: true, competitor: false },
  { feature: "Bank transfer / manual payment tracking", stackivo: true, competitor: true },
  { feature: "FIRA/FIRC for export payments", stackivo: true, competitor: false },
  { category: "Pricing & Limits" },
  { feature: "Free forever plan", stackivo: "5 clients", competitor: "No (trial only)" },
  { feature: "Starting price (monthly)", stackivo: "₹499/mo", competitor: "₹399/mo" },
  { feature: "Client limit on paid plans", stackivo: "Unlimited", competitor: "Unlimited" },
  { feature: "Team/collaborator seats", stackivo: "Business", competitor: false },
];

const SUMMARY = {
  stackivoWins: [
    "Complete all-in-one: CRM, projects, contracts, time, portal, analytics",
    "Contracts + e-signature included in Pro",
    "Time tracking → invoice workflow",
    "Client portal with approvals on Pro",
    "Multi-currency + FIRA/FIRC for export",
    "Free forever plan (5 clients)",
  ],
  competitorWins: [
    "Lower starting price (₹399 vs ₹499)",
    "Stronger focus on recurring/subscription billing automation",
    "Simpler if you only need recurring invoices",
  ],
  neutral: [
    "Both India-first with GST support",
    "Both support UPI/Razorpay",
    "Both have recurring invoices on paid plans",
  ],
};

const VERDICT = "Retainer specializes in recurring/subscription billing for Indian freelancers — it does that one thing well. Stackivo is a complete freelancer business OS: it adds contracts, e-signature, projects, time tracking, client portal, and business analytics. If your entire business is recurring invoices, Retainer's lower price and focused feature set may suffice. If you manage projects, track time, send contracts, and need a client portal — Stackivo replaces 4-5 tools and pays for itself in time saved.";

const FACTUAL_FAQS = [
  {
    q: "Does Retainer have contracts and e-signature?",
    a: "No. Retainer focuses on recurring invoicing. It does not have contract templates, e-signature, or contract-to-invoice workflow.",
  },
  {
    q: "Can Retainer track time and convert to invoices?",
    a: "No. Retainer does not have built-in time tracking or time-to-invoice conversion.",
  },
  {
    q: "Does Retainer have a client portal?",
    a: "No. Retainer does not currently offer a client portal for document sharing, approvals, or project updates.",
  },
  {
    q: "Is Retainer cheaper than Stackivo?",
    a: "Retainer starts at ₹399/mo vs Stackivo Pro at ₹499/mo. However, Stackivo Pro includes contracts, e-signature, projects, time tracking, client portal, and analytics — features that would require separate tools with Retainer.",
  },
  {
    q: "Can I import data from Retainer to Stackivo?",
    a: "Stackivo supports CSV import for clients. For invoices and other records, we recommend exporting from Retainer and recreating key records in Stackivo for accuracy.",
  },
];

export default function RetainerComparisonPage() {
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