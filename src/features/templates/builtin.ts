import type { Json } from "@/lib/supabase/types";

export type TemplateType = "proposal" | "contract" | "invoice_note" | "email";

export interface TemplateRecord {
  id: string;
  userId: string | null;
  templateType: TemplateType;
  title: string;
  description: string | null;
  category: string;
  content: Json;
  active: boolean;
  isSystem: boolean;
  updatedAt: string | null;
}

export interface ProposalTemplateContent {
  scope?: string;
  deliverables?: string;
  timeline?: string;
  terms?: string;
  items?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export const BUILTIN_TEMPLATES: TemplateRecord[] = [
  {
    id: "proposal-website-build",
    userId: null,
    templateType: "proposal",
    title: "Website Build Proposal",
    description: "A polished package for design/development projects with phased delivery.",
    category: "design-development",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "This proposal covers planning, design, development, responsive implementation, testing, and launch support for the agreed website.",
      deliverables:
        "- Discovery and structure recommendations\n- Responsive website design\n- Development and CMS/basic handoff\n- QA across desktop and mobile\n- Launch support and one post-launch review",
      timeline:
        "Estimated timeline: 4-6 weeks from kickoff, subject to timely content, feedback, and access sharing.",
      terms:
        "50% advance to start, 50% before final handoff. Two rounds of revisions are included. Additional scope is quoted separately before work begins.",
      items: [
        { description: "Website design and development package", quantity: 1, unitPrice: 0 },
      ],
    },
  },
  {
    id: "proposal-monthly-retainer",
    userId: null,
    templateType: "proposal",
    title: "Monthly Retainer Proposal",
    description: "Recurring support proposal for ongoing design, development, or marketing work.",
    category: "retainer",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "This retainer covers ongoing monthly support for agreed priority tasks, advisory support, and execution within the monthly capacity.",
      deliverables:
        "- Monthly planning and priority alignment\n- Execution of agreed tasks\n- Weekly progress summary\n- Light advisory and async support\n- End-of-month work summary",
      timeline:
        "Monthly rolling engagement. Work begins after payment confirmation and renews every billing cycle unless cancelled.",
      terms:
        "Retainer fees are billed in advance. Unused hours do not roll over unless explicitly agreed. Urgent or out-of-scope work may be quoted separately.",
      items: [{ description: "Monthly retainer", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "invoice-note-export-service",
    userId: null,
    templateType: "invoice_note",
    title: "Export Service Invoice Note",
    description: "Short note for foreign clients and zero-rated export services.",
    category: "export",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      body:
        "This invoice is for export of services. GST is zero-rated where applicable. Payment may be made in the invoice currency; internal INR records use the locked conversion rate.",
    },
  },
  {
    id: "email-proposal-follow-up",
    userId: null,
    templateType: "email",
    title: "Proposal Follow-up",
    description: "A concise follow-up after sharing a proposal.",
    category: "sales",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      subject: "Following up on the proposal",
      body:
        "Hi [client name],\n\nI wanted to check whether you had a chance to review the proposal. Happy to clarify scope, timeline, or pricing if helpful.\n\nIf everything looks good, I can help with the next step and get the project moving.\n\nBest,\n[your name]",
    },
  },
];
