import type { Json } from "@/lib/supabase/types";

export type TemplateType = "proposal" | "contract" | "welcome_doc" | "invoice_note" | "email";

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

export interface ContractTemplateContent {
  kind?: "contract" | "proposal";
  highlights?: string[];
  sections?: Array<{
    heading: string;
    body: string;
  }>;
}

export interface WelcomeDocTemplateContent {
  intro?: string;
  acknowledgementRequired?: boolean;
  sections?: Array<{
    heading: string;
    body: string;
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
    id: "contract-project-agreement",
    userId: null,
    templateType: "contract",
    title: "Project Services Contract",
    description: "A practical agreement for Indian freelancers working with domestic or foreign clients.",
    category: "project",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: ["Scope", "Payment terms", "IP ownership", "Electronic execution"],
      sections: [
        {
          heading: "Scope of work",
          body:
            "This agreement covers services for {{project_name}} between {{business_name}} and {{client_name}}. The work includes the deliverables agreed in writing before kickoff. Any material change in scope, timeline, or commercial terms will be handled through a written change request.",
        },
        {
          heading: "Fees and payment",
          body:
            "Total fee: {{currency}} [amount]. Payment is due as per the agreed invoice schedule. Work may pause if payment is overdue. Third-party costs, taxes, software, hosting, paid assets, and out-of-scope requests are billed separately unless included in writing.",
        },
        {
          heading: "Client responsibilities",
          body:
            "The client will provide timely content, access, feedback, approvals, and a single decision-maker. Delays in these inputs may shift timelines by the same amount.",
        },
        {
          heading: "Intellectual property",
          body:
            "After full and final payment, the client owns the final approved deliverables created specifically for the client. The freelancer retains ownership of pre-existing materials, reusable tools, templates, processes, know-how, and general skills.",
        },
        {
          heading: "Electronic execution",
          body:
            "This agreement may be signed electronically and in counterparts. Electronic signatures and electronic records are valid to the extent permitted by applicable law, including the Information Technology Act, 2000 in India and equivalent e-sign laws where relevant.",
        },
      ],
    },
  },
  {
    id: "contract-monthly-retainer",
    userId: null,
    templateType: "contract",
    title: "Monthly Retainer Contract",
    description: "Ongoing monthly support with clear capacity, request, billing, and cancellation terms.",
    category: "retainer",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: ["Monthly capacity", "Request process", "Billing", "Cancellation"],
      sections: [
        {
          heading: "Retainer scope",
          body:
            "This retainer covers recurring support for {{client_name}}. The monthly capacity includes up to [number] hours per month for [design/development/content/strategy] support.",
        },
        {
          heading: "Requests and availability",
          body:
            "Requests should be submitted through [email/portal/project tool]. The freelancer will confirm priority, estimated effort, and expected delivery before starting. Rush requests, weekend work, or emergency support are not included unless agreed in writing.",
        },
        {
          heading: "Fees and billing",
          body:
            "Monthly retainer fee: {{currency}} [amount]. Fees are billed in advance and payable within [number] days. Unused hours [do/do not] roll over for [number] days. Work may pause if payment becomes overdue.",
        },
        {
          heading: "Term and cancellation",
          body:
            "This retainer begins on [start date] and continues monthly until cancelled. Either party may cancel with [number] days written notice. Completed work and relevant files will be handed over up to the paid-through date.",
        },
        {
          heading: "Electronic execution",
          body:
            "This agreement may be signed electronically and in counterparts. Electronic signatures and electronic records are valid to the extent permitted by applicable law.",
        },
      ],
    },
  },
  {
    id: "welcome-client-onboarding",
    userId: null,
    templateType: "welcome_doc",
    title: "Client Onboarding Guide",
    description: "A warm kickoff guide covering workflow, communication, approvals, and next steps.",
    category: "onboarding",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      intro:
        "Welcome. This guide keeps our project clear from day one: how we will communicate, what I need from you, and how approvals will work.",
      acknowledgementRequired: false,
      sections: [
        {
          heading: "How we will work",
          body:
            "I will keep the project organised through agreed milestones, written updates, and clear next steps. Please keep one decision-maker available so feedback and approvals stay smooth.",
        },
        {
          heading: "What I need from you",
          body:
            "- Brand assets, logins, and content\n- Existing references or examples\n- Timely feedback on shared drafts\n- Any legal, compliance, or brand requirements before work starts",
        },
        {
          heading: "Communication rhythm",
          body:
            "Most updates will be shared asynchronously. Calls can be scheduled for kickoff, important decisions, or review points. Urgent requests should be marked clearly with context and deadline.",
        },
        {
          heading: "Approvals and changes",
          body:
            "Please review each milestone carefully. Approved work becomes the base for the next step. New requests or material changes may affect timeline or pricing and will be confirmed before work continues.",
        },
      ],
    },
  },
  {
    id: "welcome-agency-handoff",
    userId: null,
    templateType: "welcome_doc",
    title: "Project Handoff Welcome Pack",
    description: "Useful after proposal acceptance to collect assets, access, and expectations.",
    category: "handoff",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      intro:
        "Thanks for moving ahead. This handoff pack explains what happens next and what I need before kickoff.",
      acknowledgementRequired: true,
      sections: [
        {
          heading: "Before kickoff",
          body:
            "Please share the final scope confirmation, required assets, technical access, and any timeline constraints. If something is not available yet, tell me the expected date so I can plan around it.",
        },
        {
          heading: "Access and security",
          body:
            "Share access through secure invite links wherever possible. Avoid sending passwords in plain text. If account access is sensitive, we can coordinate the safest method before kickoff.",
        },
        {
          heading: "Review process",
          body:
            "Each review round should include consolidated feedback. This helps avoid conflicting comments and keeps the delivery timeline predictable.",
        },
        {
          heading: "Payments and invoices",
          body:
            "Invoices and payment milestones will follow the agreed proposal or contract. Work begins after the required kickoff payment or written approval is complete.",
        },
      ],
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
        "Hi {{client_name}},\n\nI wanted to check whether you had a chance to review the proposal. Happy to clarify scope, timeline, or pricing if helpful.\n\nIf everything looks good, I can help with the next step and get the project moving.\n\nBest,\n{{freelancer_name}}",
    },
  },
];
