import type { Metadata } from "next";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ComparisonHero, ComparisonTable, ComparisonSummary, ComparisonVerdict, FAQSchema } from "@/components/marketing/comparison-page";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Stackivo vs Bonsai · Freelancer business OS comparison",
  description: "Compare Stackivo and Bonsai for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals. Bonsai is US-built for global freelancers.",
  alternates: { canonical: "/compare/stackivo-vs-bonsai" },
  openGraph: {
    title: "Stackivo vs Bonsai · Freelancer business OS comparison",
    description: "Compare Stackivo and Bonsai for freelancer management. Stackivo is India-first with GST, contracts, projects, time tracking, and client portals.",
    url: `${siteConfig.url}/compare/stackivo-vs-bonsai`,
  },
};

const COMPETITOR = "Bonsai";
const COMPETITOR_TAGLINE = "US-built freelancer toolkit for global solopreneurs — contracts, invoices, and proposals.";
const COMPETITOR_WEBSITE = "https://www.hellobonsai.com";

const ROWS = [
  { category: "Core positioning" },
  { feature: "Built for Indian freelancers (GST, INR, India support)", stackivo: true, competitor: false },
  { feature: "Freelancer-first workflow (vs agency/SMB)", stackivo: true, competitor: true },
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
  { feature: "E-signature (legally valid in India)", stackivo: "Pro", competitor: "Add-on" },
  { feature: "Contract → invoice workflow", stackivo: true, competitor: false },
  { feature: "Public signing links", stackivo: true, competitor: true },
  { category: "Projects & Time" },
  { feature: "Project workspaces with milestones", stackivo: true, competitor: true },
  { feature: "Time tracking → invoice", stackivo: true, competitor: false },
  { feature: "Billable rates per project/task", stackivo: true, competitor: true },
  { feature: "Time reports & exports", stackivo: true, competitor: true },
  { category: "Client Portal" },
  { feature: "Client portal (documents, updates, files)", stackivo: "Pro", competitor: true },
  { feature: "Custom portal branding", stackivo: "Business", competitor: false },
  { feature: "Client approvals on deliverables", stackivo: true, competitor: false },
  { category: "Payments & Banking" },
  { feature: "UPI / Razorpay integration", stackivo: true, competitor: false },
  { feature: "Stripe / PayPal integration", stackivo: true, competitor: true },
  { feature: "Bank transfer / manual payment tracking", stackivo: true, competitor: true },
  { feature: "FIRA/FIRC for export payments", stackivo: true, competitor: false },
  { category: "Pricing & Limits" },
  { feature: "Free forever plan", stackivo: "5 clients", competitor: "Limited trial" },
  { feature: "Starting price (monthly)", stackivo: "₹499/mo", competitor: "$29/mo" },
  { feature: "Client limit on paid plans", stackivo: "Unlimited", competitor: "Unlimited" },
  { feature: "Team/collaborator seats", stackivo: "Business", competitor: "Add-on" },
];

const SUMMARY = {
  stackivoWins: [
    "India-first: GST, INR, place-of-supply, FIRA/FIRC",
    "Contracts + e-signature included in Pro (Bonsai charges extra)",
    "Time tracking → invoice workflow built-in",
    "Client portal with approvals on Pro",
    "UPI/Razorpay + FIRA/FIRC for Indian payments",
    "Founder-level support included",
  ],
  competitorWins: [
    "More mature global template library",
    "Native integration with more US payment processors",
    "Longer track record (launched 2015)",
  ],
  neutral: [
    "Both offer contracts, proposals, invoices, projects",
    "Both have client portals on paid plans",
    "Both support multi-currency invoicing",
  ],
};

const VERDICT = "Bonsai is a polished global freelancer toolkit — great if you work mostly with US clients and don't need Indian tax compliance. Stackivo is purpose-built for Indian freelancers: GST, INR, UPI, FIRA/FIRC, and Indian contract law are baked in, not bolted on. If you're an Indian freelancer, Stackivo saves you from stitching together multiple tools and manually handling tax edge cases. If you're a global freelancer billing mostly in USD, Bonsai's mature template library and Stripe ecosystem may feel more familiar.";

const FACTUAL_FAQS = [
  {
    q: "Does Bonsai support GST invoicing for Indian freelancers?",
    a: "No. Bonsai does not have built-in GST support (CGST/SGST/IGST split, GSTIN validation, place-of-supply logic). You would need to manually calculate and apply taxes.",
  },
  {
    q: "Can I use Stackivo for international clients?",
    a: "Yes. Stackivo supports multi-currency invoicing with locked FX rates at issue date, zero-rated export invoices under LUT, and FIRA/FIRC generation for export payments.",
  },
  {
    q: "Which is cheaper for an Indian freelancer?",
    a: "Stackivo Pro is ₹499/mo (≈$6) with all features including contracts, e-signature, client portal, and time tracking. Bonsai's equivalent plan is $29/mo (≈₹2,400) plus add-ons for e-signature and some integrations.",
  },
  {
    q: "Can I import data from Bonsai to Stackivo?",
    a: "Stackivo supports CSV import for clients. For invoices, contracts, and projects, we recommend exporting from Bonsai and recreating key records in Stackivo for accuracy.",
  },
  {
    q: "Does Bonsai have a client portal?",
    a: "Yes, Bonsai offers a client portal on paid plans for sharing documents and collecting payments.",
  },
];

export default function BonsaiComparisonPage() {
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