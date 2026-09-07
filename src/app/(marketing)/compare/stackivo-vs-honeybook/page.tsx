import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ComparisonHero, ComparisonTable, ComparisonSummary, ComparisonVerdict, FAQSchema } from "@/components/marketing/comparison-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Stackivo vs HoneyBook · Freelancer business OS comparison",
  description: "Compare Stackivo and HoneyBook for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals. HoneyBook is US-built for creative professionals.",
  alternates: { canonical: "/compare/stackivo-vs-honeybook" },
  openGraph: {
    title: "Stackivo vs HoneyBook · Freelancer business OS comparison",
    description: "Compare Stackivo and HoneyBook for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals.",
    url: `${siteConfig.url}/compare/stackivo-vs-honeybook`,
  },
};

const COMPETITOR = "HoneyBook";
const COMPETITOR_TAGLINE = "US-built clientflow platform for creative professionals — contracts, invoices, scheduling, and automation.";
const COMPETITOR_WEBSITE = "https://www.honeybook.com";

const ROWS = [
  { category: "Core positioning" },
  { feature: "Built for Indian freelancers (GST, INR, India support)", stackivo: true, competitor: false },
  { feature: "Creative-professional focus (photographers, designers)", stackivo: false, competitor: true },
  { feature: "All-in-one workspace (CRM + projects + finance)", stackivo: true, competitor: true },
  { category: "GST & Invoicing" },
  { feature: "GST-ready invoicing (CGST/SGST/IGST split)", stackivo: true, competitor: false },
  { feature: "GSTIN validation & auto-fetch", stackivo: true, competitor: false },
  { feature: "Place-of-supply logic (inter vs intra state)", stackivo: true, competitor: false },
  { feature: "Export invoices (zero-rated under LUT)", stackivo: true, competitor: false },
  { feature: "Recurring invoices", stackivo: "Pro", competitor: true },
  { feature: "Custom branding on invoices", stackivo: "Pro", competitor: true },
  { feature: "Multi-currency with locked FX rates", stackivo: true, competitor: true },
  { category: "Contracts & E-signature" },
  { feature: "Contract templates (freelancer-specific)", stackivo: true, competitor: true },
  { feature: "E-signature (legally valid in India)", stackivo: "Pro", competitor: true },
  { feature: "Contract → invoice workflow", stackivo: true, competitor: true },
  { feature: "Public signing links", stackivo: true, competitor: true },
  { category: "Projects & Time" },
  { feature: "Project workspaces with milestones", stackivo: true, competitor: "Limited" },
  { feature: "Time tracking → invoice", stackivo: true, competitor: false },
  { feature: "Billable rates per project/task", stackivo: true, competitor: false },
  { feature: "Time reports & exports", stackivo: true, competitor: false },
  { category: "Client Portal" },
  { feature: "Client portal (documents, updates, files)", stackivo: "Pro", competitor: true },
  { feature: "Custom portal branding", stackivo: "Business", competitor: true },
  { feature: "Client approvals on deliverables", stackivo: true, competitor: false },
  { category: "Payments & Banking" },
  { feature: "UPI / Razorpay integration", stackivo: true, competitor: false },
  { feature: "Stripe / PayPal / Square integration", stackivo: true, competitor: true },
  { feature: "Bank transfer / manual payment tracking", stackivo: true, competitor: true },
  { feature: "FIRA/FIRC for export payments", stackivo: true, competitor: false },
  { category: "Automation & CRM" },
  { feature: "Visual workflow builder", stackivo: "Pro", competitor: true },
  { feature: "Email automation sequences", stackivo: "Pro", competitor: true },
  { feature: "Lead capture forms", stackivo: true, competitor: true },
  { category: "Pricing & Limits" },
  { feature: "Free forever plan", stackivo: "5 clients", competitor: "No (trial only)" },
  { feature: "Starting price (monthly)", stackivo: "₹499/mo", competitor: "$16/mo (annual)" },
  { feature: "Client limit on paid plans", stackivo: "Unlimited", competitor: "Unlimited" },
  { feature: "Team/collaborator seats", stackivo: "Business", competitor: "Higher tier" },
];

const SUMMARY = {
  stackivoWins: [
    "India-first: GST, INR, place-of-supply, FIRA/FIRC",
    "Time tracking → invoice workflow built-in",
    "Billable rates per project/task",
    "Client approvals on deliverables in portal",
    "UPI/Razorpay + FIRA/FIRC for Indian payments",
    "Free forever plan (5 clients)",
    "Lower starting price for Indian market",
  ],
  competitorWins: [
    "Stronger visual workflow/automation builder",
    "Better scheduling/calendar integration",
    "More mature for creative professionals (photographers, event planners)",
    "Larger template marketplace",
  ],
  neutral: [
    "Both offer contracts, e-signature, invoices",
    "Both have client portals on paid plans",
    "Both support Stripe/PayPal",
  ],
};

const VERDICT = "HoneyBook excels for US-based creative professionals who need strong scheduling, automation, and a polished client experience. It's built around the creative workflow (booking → questionnaire → contract → invoice). Stackivo is purpose-built for Indian freelancers: GST compliance, INR pricing, UPI payments, FIRA/FIRC, and Indian contract law are native. If you're an Indian freelancer — developer, designer, consultant, writer — Stackivo handles your tax and payment reality out of the box. HoneyBook requires workarounds for GST and has no UPI/FIRA support.";

const FACTUAL_FAQS = [
  {
    q: "Does HoneyBook support GST invoicing for Indian freelancers?",
    a: "No. HoneyBook does not have built-in GST support (CGST/SGST/IGST split, GSTIN validation, place-of-supply logic). You would need to manually calculate and apply taxes.",
  },
  {
    q: "Can I use Stackivo for international clients like HoneyBook?",
    a: "Yes. Stackivo supports multi-currency invoicing with locked FX rates at issue date, zero-rated export invoices under LUT, and FIRA/FIRC generation for export payments.",
  },
  {
    q: "Which is better for a freelance designer in India?",
    a: "Stackivo. You get GST-compliant invoicing, INR pricing, UPI payments, and Indian contract templates — plus time tracking and project milestones. HoneyBook's strength is scheduling and automation for US creative workflows, not Indian tax compliance.",
  },
  {
    q: "Does HoneyBook have time tracking that creates invoices?",
    a: "No. HoneyBook does not have built-in time tracking that converts to invoices. You would need a separate time tracker.",
  },
  {
    q: "Can I import data from HoneyBook to Stackivo?",
    a: "Stackivo supports CSV import for clients. For invoices, contracts, and projects, we recommend exporting from HoneyBook and recreating key records in Stackivo for accuracy.",
  },
];

export default function HoneyBookComparisonPage() {
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