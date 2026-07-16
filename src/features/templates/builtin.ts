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
        "Understanding\n{{client_name}} needs a modern, fast website that presents the offer clearly and turns visitors into enquiries. This proposal covers a complete design-and-build for {{project_name}} — from structure and messaging through responsive design, development, testing, and launch.\n\nApproach\nWe work in clear phases — Discovery & structure, Design, Build, then QA & launch — with your review and sign-off at each stage, so there are no surprises and momentum stays high.",
      deliverables:
        "Included\n- Discovery: sitemap, page structure, and a content plan\n- Responsive design for all agreed pages (desktop, tablet, mobile)\n- Development on [platform] with a simple CMS/editing handoff\n- On-page SEO basics, contact/lead forms, and analytics setup\n- QA across current browsers and devices\n- Launch support and one post-launch review\n\nNot included (quoted separately)\n- Copywriting, logo/branding, and photography\n- Paid plugins, premium fonts, stock, and hosting\n- Ongoing maintenance and pages beyond the agreed count",
      timeline:
        "Estimated 4–6 weeks from kickoff:\n- Week 1 — Discovery & structure\n- Weeks 2–3 — Design & approval\n- Weeks 3–5 — Build\n- Week 6 — QA, revisions & launch\n\nDates assume timely content, feedback, and access from your side.",
      terms:
        "Investment & payment\n50% to start and 50% before final handover; applicable taxes are additional. Two rounds of revisions per stage are included; further changes are quoted before work begins.\n\nOwnership\nOn full payment you own the final website files. Reusable tools and third-party licenses remain as noted in the agreement.\n\nNext steps\nApprove this proposal, we'll send the agreement and confirm a kickoff date, and begin with Discovery.",
      items: [
        { description: "Website design & development package", quantity: 1, unitPrice: 0 },
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
        "Understanding\n{{client_name}} needs dependable, ongoing support without the overhead of a full-time hire. This retainer reserves a block of my time each month for {{project_name}} — priority execution, advisory input, and steady progress on the things that matter most.\n\nApproach\nWe agree priorities at the start of each month, I execute within the reserved capacity, and you get a clear summary of what shipped. Priorities can flex month to month as your needs change.",
      deliverables:
        "Included each month\n- Monthly planning & priority alignment\n- Up to [number] hours of execution on agreed tasks\n- Weekly progress updates\n- Light advisory and async support during business hours\n- An end-of-month summary of work delivered\n\nNot included (quoted separately)\n- Rush, weekend, or emergency work\n- Large one-off projects outside the monthly capacity\n- Third-party costs (ad spend, tools, licenses)",
      timeline:
        "Monthly rolling engagement. Work begins after the first payment is confirmed and renews each billing cycle until cancelled with [15] days' notice. Unused capacity [does not roll over / rolls over up to [number] hours].",
      terms:
        "Investment & payment\nRetainer fee is billed in advance each month; applicable taxes are additional. Work may pause if payment is overdue.\n\nOwnership\nDeliverables produced and paid for each month transfer to you; my reusable tools and frameworks remain mine, licensed for your use.\n\nNext steps\nApprove this proposal, we'll confirm your start date and first month's priorities, and get moving.",
      items: [{ description: "Monthly retainer", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-brand-identity",
    userId: null,
    templateType: "proposal",
    title: "Brand Identity Proposal",
    description: "Logo, visual identity, and brand guidelines for a distinctive, consistent brand.",
    category: "branding",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants a brand that looks credible, feels distinctive, and stays consistent everywhere it appears. This proposal covers a complete visual identity for {{project_name}} — from direction through a primary logo, a full identity system, and guidelines your team can actually use.\n\nApproach\nWe start with a short discovery to align on positioning and audience, explore directions, then refine the chosen route into a polished, documented system.",
      deliverables:
        "Included\n- Discovery & moodboard/direction (2 concepts)\n- Primary logo + secondary/marks and clear-space rules\n- Colour palette and typography system\n- Core applications (e.g., business card, social avatar, letterhead)\n- Brand guidelines PDF\n- Final files in all standard formats (vector + web)\n\nNot included (quoted separately)\n- Website design/build, packaging, or motion\n- Copywriting and photography\n- Printing and third-party font licenses",
      timeline:
        "Estimated 3–4 weeks:\n- Week 1 — Discovery & direction\n- Week 2 — Logo concepts & selection\n- Week 3 — Identity system & applications\n- Week 4 — Guidelines & final handoff\n\nAssumes prompt feedback at each stage.",
      terms:
        "Investment & payment\n50% to start, 50% before final files are released; taxes extra. Two rounds of revisions on the chosen direction are included.\n\nOwnership\nOn full payment you own the final approved brand assets; exploratory concepts and working files remain mine unless agreed.\n\nNext steps\nApprove this proposal and we'll book your discovery session and start.",
      items: [{ description: "Brand identity package", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-marketing-campaign",
    userId: null,
    templateType: "proposal",
    title: "Marketing / Growth Campaign Proposal",
    description: "A results-focused campaign across the right channels, with clear metrics and reporting.",
    category: "marketing",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants more qualified leads and measurable growth, not vanity metrics. This proposal covers a focused campaign for {{project_name}} across the channels most likely to reach your audience, with a clear plan, execution, and honest reporting.\n\nApproach\nWe define the goal and target audience, build a channel plan and messaging, launch and optimise, and review results against agreed metrics.",
      deliverables:
        "Included\n- Goal, audience, and channel strategy\n- Campaign messaging and creative direction\n- Setup and execution across [chosen channels]\n- Landing page/funnel review and recommendations\n- Tracking setup (analytics + conversions)\n- Bi-weekly performance reporting\n\nNot included (quoted separately)\n- Ad spend / media budget (paid directly by client)\n- Website builds and long-form content production\n- Tools and platform subscriptions",
      timeline:
        "Initial [6–8] week engagement:\n- Week 1 — Strategy & setup\n- Weeks 2–6 — Launch & optimise\n- Ongoing — Bi-weekly reviews\n\nCampaigns need a ramp period; early data guides optimisation.",
      terms:
        "Investment & payment\nFee billed [monthly / 50% upfront]; ad spend is separate and paid directly by you. Taxes extra.\n\nReporting\nYou get transparent reporting against agreed metrics; results depend on budget, market, and offer.\n\nNext steps\nApprove this proposal and we'll confirm goals, budget, and a start date.",
      items: [{ description: "Marketing campaign management", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-seo",
    userId: null,
    templateType: "proposal",
    title: "SEO Project Proposal",
    description: "Technical fixes, on-page optimisation, and content strategy to grow organic traffic.",
    category: "seo",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants to rank for the terms that bring real customers and grow organic traffic sustainably. This proposal covers an SEO engagement for {{project_name}} — a technical foundation, on-page optimisation, and a content roadmap.\n\nApproach\nWe audit, fix the fundamentals, optimise priority pages, and set a content plan targeting keywords with genuine intent and a realistic path to rank.",
      deliverables:
        "Included\n- Technical SEO audit & priority fixes\n- Keyword research and mapping to pages\n- On-page optimisation for [number] priority pages\n- Content roadmap (topics + briefs)\n- Analytics & Search Console setup/review\n- Monthly ranking & traffic report\n\nNot included (quoted separately)\n- Content writing at scale and link outreach\n- Website redevelopment\n- Paid tools/subscriptions",
      timeline:
        "First [3] months:\n- Month 1 — Audit, fixes & keyword mapping\n- Month 2 — On-page optimisation & content briefs\n- Month 3 — Content rollout & first results review\n\nSEO compounds; meaningful movement typically takes 3–6 months.",
      terms:
        "Investment & payment\nBilled monthly in advance; taxes extra. Minimum [3] month commitment recommended for results.\n\nExpectations\nRankings depend on competition and search-engine changes; no specific position is guaranteed.\n\nNext steps\nApprove this proposal and we'll start with the audit and access setup.",
      items: [{ description: "SEO engagement (monthly)", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-content-copywriting",
    userId: null,
    templateType: "proposal",
    title: "Content & Copywriting Proposal",
    description: "Clear, on-brand copy — website, sales, or content — written to convert and rank.",
    category: "content",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} needs words that sound like the brand and move readers to act. This proposal covers copywriting for {{project_name}} — researched, structured, and edited to be clear, persuasive, and consistent.\n\nApproach\nWe align on voice and goals, research the audience and offer, draft, then refine with your feedback so the copy earns its place.",
      deliverables:
        "Included\n- Voice & messaging alignment\n- Research (audience, offer, competitors)\n- [Website / sales / blog] copy for the agreed scope\n- SEO-aware structure where relevant\n- Two rounds of revisions\n- Final copy in a shareable doc\n\nNot included (quoted separately)\n- Design, development, and publishing\n- Ongoing content beyond the agreed pieces\n- Stock imagery and translation",
      timeline:
        "Estimated [2–3] weeks:\n- Days 1–3 — Alignment & research\n- Week 1–2 — First drafts\n- Week 2–3 — Revisions & final\n\nAssumes prompt access to product details and feedback.",
      terms:
        "Investment & payment\n50% to start, 50% on delivery; taxes extra. Two rounds of revisions included; further edits are quoted.\n\nOwnership\nOn full payment you own the final copy; research notes remain mine.\n\nNext steps\nApprove this proposal and we'll book a short brief call to begin.",
      items: [{ description: "Copywriting project", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-social-media",
    userId: null,
    templateType: "proposal",
    title: "Social Media Management Proposal",
    description: "Consistent, on-brand social presence — planning, content, and community, month over month.",
    category: "social-media",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants a consistent, professional social presence without the daily burden of running it. This proposal covers ongoing social media management for {{project_name}} — planning, content, scheduling, and light community engagement.\n\nApproach\nWe set a monthly content plan aligned to your goals, produce and schedule posts, engage within agreed hours, and report on what's working.",
      deliverables:
        "Included each month\n- Monthly content calendar\n- [number] posts across [platforms] (graphics + captions)\n- Scheduling and publishing\n- Light community management (comments/DMs) during business hours\n- Monthly performance report\n\nNot included (quoted separately)\n- Paid ads and ad spend\n- Video production and photoshoots\n- Influencer outreach and giveaways",
      timeline:
        "Monthly rolling engagement. Content is planned a month ahead; the first calendar is delivered within [1] week of kickoff. Cancel any time with [15] days' notice.",
      terms:
        "Investment & payment\nMonthly fee billed in advance; taxes and ad spend extra.\n\nApproach\nYou approve the calendar before publishing; results build over time with consistency.\n\nNext steps\nApprove this proposal, share account access, and we'll build your first calendar.",
      items: [{ description: "Social media management (monthly)", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-app-development",
    userId: null,
    templateType: "proposal",
    title: "App / Product Development Proposal",
    description: "Build a web or mobile product in phases, from MVP scope to tested release.",
    category: "product-development",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants to build {{project_name}} — a focused, reliable product that solves a real problem for its users. This proposal covers the design and development of an agreed MVP scope, built in phases with your input at each milestone.\n\nApproach\nWe define the core feature set, design the key flows, build in iterations with demos, and test before release — keeping scope tight so you ship.",
      deliverables:
        "Included\n- Discovery: core features, user flows, and scope\n- UI/UX design for the agreed screens\n- Development of the MVP feature set on [stack]\n- Core integrations (auth, payments, etc. as agreed)\n- QA and bug fixing for delivered scope\n- Deployment and handover\n\nNot included (quoted separately)\n- Features beyond the agreed MVP\n- Ongoing maintenance and new versions\n- Third-party services, hosting, and app-store fees",
      timeline:
        "Phased over [8–12] weeks:\n- Weeks 1–2 — Discovery & design\n- Weeks 3–8 — Iterative build with demos\n- Weeks 9–10 — QA & release\n\nEstimate refined after discovery; scope changes affect timeline.",
      terms:
        "Investment & payment\nMilestone-based: [30]% to start, staged payments at agreed milestones, balance on release. Taxes extra.\n\nOwnership\nOn full payment you own the product code created for you; reusable libraries and third-party licenses remain as noted.\n\nNext steps\nApprove this proposal and we'll begin discovery to lock the MVP scope.",
      items: [{ description: "Product development (MVP)", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-consulting",
    userId: null,
    templateType: "proposal",
    title: "Consulting / Strategy Proposal",
    description: "Expert advisory and a clear action plan — audit, recommendations, and guided implementation.",
    category: "consulting",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} needs clarity and a credible plan more than more hands. This proposal covers a consulting engagement for {{project_name}} — assessing the current situation, identifying the highest-impact moves, and giving you a practical roadmap (with support to act on it).\n\nApproach\nWe diagnose, prioritise, and recommend — then, if helpful, guide implementation so the plan actually happens.",
      deliverables:
        "Included\n- Discovery & current-state assessment\n- Prioritised findings and opportunities\n- A clear, actionable roadmap\n- A working session to align your team\n- [number] follow-up advisory calls\n\nNot included (quoted separately)\n- Hands-on execution and production work\n- Ongoing retained advisory (available as a retainer)\n- Third-party tools and research costs",
      timeline:
        "Estimated [2–4] weeks:\n- Week 1 — Discovery & data gathering\n- Week 2 — Analysis & roadmap\n- Week 3 — Readout & working session\n\nFollow-up calls scheduled as needed.",
      terms:
        "Investment & payment\n[50]% to start, balance on delivery of the roadmap; taxes extra. Fixed-fee for the defined scope.\n\nOutcome\nYou get an honest assessment and a plan; results depend on execution.\n\nNext steps\nApprove this proposal and we'll book your discovery session.",
      items: [{ description: "Consulting engagement", quantity: 1, unitPrice: 0 }],
    },
  },
  {
    id: "proposal-video-photography",
    userId: null,
    templateType: "proposal",
    title: "Video / Photography Proposal",
    description: "A produced shoot — planning, capture, and edited deliverables ready to publish.",
    category: "creative-production",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      scope:
        "Understanding\n{{client_name}} wants polished, on-brand visuals that work across the channels you care about. This proposal covers a produced [video / photography] project for {{project_name}} — from planning through the shoot to edited, ready-to-use deliverables.\n\nApproach\nWe plan the shot list and logistics, capture on the day, then edit to your brief with a clear revision round.",
      deliverables:
        "Included\n- Pre-production: concept, shot list, and schedule\n- [number] hours/day of shooting at [location]\n- Professional editing and colour/retouching\n- [number] final [videos / edited images] in agreed formats\n- One round of revisions\n\nNot included (quoted separately)\n- Additional shoot days, locations, or talent\n- Travel, permits, props, and set costs\n- Extra deliverables, formats, or raw files",
      timeline:
        "Estimated [2–3] weeks:\n- Week 1 — Pre-production & scheduling\n- Shoot day — [date]\n- Weeks 2–3 — Editing, revisions & delivery\n\nDates depend on location and availability.",
      terms:
        "Investment & payment\n[50]% to book the date, balance on delivery; taxes and third-party costs extra. Booking secures the shoot date.\n\nUsage & ownership\nOn full payment you receive the agreed final deliverables with usage rights as specified; raw footage/files remain mine unless agreed.\n\nNext steps\nApprove this proposal to lock your shoot date.",
      items: [{ description: "Video/photography production", quantity: 1, unitPrice: 0 }],
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
      highlights: [
        "Scope & change control",
        "Payment & taxes",
        "IP on payment",
        "Confidentiality",
        "Termination",
      ],
      sections: [
        {
          heading: "Parties and engagement",
          body:
            "This Services Agreement (the \"Agreement\") is made between {{business_name}} (the \"Service Provider\") and {{client_name}} (the \"Client\") for the project known as {{project_name}}. It takes effect on the date of the last signature below and governs the services described here until completed or terminated.",
        },
        {
          heading: "Scope of work",
          body:
            "The Service Provider will deliver the services and deliverables agreed in writing before kickoff (the \"Scope\"). Anything not expressly listed in the Scope is excluded. Any material change to the Scope, timeline, or fees will be handled through a written change request approved by both parties before the additional work begins.",
        },
        {
          heading: "Fees, taxes and payment",
          body:
            "Total fee: {{currency}} [amount], payable per the agreed schedule (for example, [50]% to commence and the balance before final handover). Invoices are due within [7] days. Applicable taxes (including GST where relevant) are additional. Third-party costs — hosting, domains, paid assets, plugins, ad spend — are billed at cost or paid directly by the Client. Overdue amounts may pause work and accrue interest at [1.5]% per month.",
        },
        {
          heading: "Revisions and change requests",
          body:
            "The fee includes [two] rounds of revisions per deliverable within the agreed Scope. Further revisions, new requirements, or a change in direction after approval are billed at {{currency}} [rate] per hour or quoted as a change request. This protects both parties from uncontrolled scope creep.",
        },
        {
          heading: "Client responsibilities",
          body:
            "The Client will provide timely content, brand assets, access, approvals, and a single point of contact empowered to make decisions. Where the Client's delay holds up the work, timelines shift by at least the length of the delay and milestone payments remain due as scheduled.",
        },
        {
          heading: "Intellectual property",
          body:
            "Upon full and final payment, the Client receives ownership of the final approved deliverables created specifically for {{project_name}}. Until full payment, all rights remain with the Service Provider. The Service Provider retains ownership of pre-existing materials, source files, reusable tools, frameworks, templates, know-how, and general skills, and may license (not assign) these as needed for the Client to use the deliverables.",
        },
        {
          heading: "Confidentiality",
          body:
            "Each party will keep the other's non-public information confidential and use it only to perform this Agreement. This obligation continues for [2] years after the engagement ends. It does not apply to information that is public, already known, or independently developed without using the other party's confidential information.",
        },
        {
          heading: "Portfolio rights",
          body:
            "Unless the Client requests otherwise in writing, the Service Provider may display the completed, non-confidential work in its portfolio and marketing, and may describe its role on the project.",
        },
        {
          heading: "Term and termination",
          body:
            "Either party may terminate for convenience with [7] days' written notice, or immediately for a material breach that is not cured within [7] days of notice. On termination, the Client pays for all work performed and approved expenses up to the termination date. A kill fee of {{currency}} [amount] applies if the Client cancels a committed project without cause.",
        },
        {
          heading: "Warranties and liability",
          body:
            "The Service Provider will perform the services with reasonable skill and care. Except for confidentiality and IP obligations, neither party is liable for indirect or consequential losses, and each party's total liability is limited to the fees paid under this Agreement in the [3] months before the claim. The Service Provider does not warrant uninterrupted or error-free results from third-party platforms.",
        },
        {
          heading: "Independent contractor",
          body:
            "The Service Provider is an independent contractor, not an employee, partner, or agent of the Client. The Service Provider is responsible for its own taxes, insurance, and equipment, and may use qualified subcontractors while remaining responsible for the work.",
        },
        {
          heading: "Governing law and disputes",
          body:
            "This Agreement is governed by the laws of India, with courts at [city] having jurisdiction (or the parties' agreed jurisdiction for cross-border work). The parties will attempt to resolve disputes amicably before pursuing formal remedies.",
        },
        {
          heading: "Electronic execution",
          body:
            "This Agreement may be signed electronically and in counterparts. Electronic signatures and records are valid to the extent permitted by applicable law, including the Information Technology Act, 2000 in India and equivalent e-sign laws elsewhere.",
        },
        {
          heading: "Please note",
          body:
            "This template is a professional starting point, not legal advice. Review and adapt the bracketed terms for your situation and jurisdiction, and consult a lawyer for high-value or unusual engagements.",
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
      highlights: [
        "Monthly capacity",
        "Request process",
        "Billing & rollover",
        "IP & confidentiality",
        "Cancellation",
      ],
      sections: [
        {
          heading: "Parties and term",
          body:
            "This Retainer Agreement is made between {{business_name}} (the \"Service Provider\") and {{client_name}} (the \"Client\"). It begins on [start date] and continues on a monthly rolling basis until cancelled under the terms below.",
        },
        {
          heading: "Retainer scope and capacity",
          body:
            "The Service Provider will provide recurring support of up to [number] hours per month for [design / development / content / marketing / strategy]. The retainer secures priority access and a reserved block of time each month; it is not a fixed list of deliverables unless separately agreed.",
        },
        {
          heading: "Requests and availability",
          body:
            "Requests are submitted through [email / client portal / project tool]. The Service Provider confirms priority, estimated effort, and expected delivery before starting. Standard availability is [Mon–Fri, business hours]. Rush, weekend, or emergency work is not included and is quoted separately.",
        },
        {
          heading: "Fees, billing and rollover",
          body:
            "Monthly retainer fee: {{currency}} [amount], billed in advance and due within [number] days. Applicable taxes (including GST where relevant) are additional. Unused hours [do not roll over / roll over up to [number] hours for [30] days]. Work exceeding the monthly capacity is billed at {{currency}} [rate] per hour with prior approval.",
        },
        {
          heading: "Client responsibilities",
          body:
            "The Client will provide timely briefs, assets, access, and approvals, and nominate a single point of contact. Unused capacity in a month is not refundable or transferable except as stated in the rollover terms.",
        },
        {
          heading: "Intellectual property",
          body:
            "Deliverables produced and paid for under the retainer transfer to the Client on payment for the relevant month. The Service Provider retains pre-existing materials, tools, and reusable frameworks, licensed to the Client as needed to use the deliverables.",
        },
        {
          heading: "Confidentiality",
          body:
            "Each party keeps the other's non-public information confidential during the engagement and for [2] years after it ends, using it only to perform this Agreement.",
        },
        {
          heading: "Term and cancellation",
          body:
            "Either party may cancel with [15] days' written notice, effective at the end of the notice period. Fees for the current billing cycle are non-refundable once the month has begun. On cancellation, completed work and relevant files are handed over up to the paid-through date.",
        },
        {
          heading: "Independent contractor",
          body:
            "The Service Provider is an independent contractor responsible for its own taxes, insurance, and tools, and is not an employee or agent of the Client.",
        },
        {
          heading: "Governing law and execution",
          body:
            "This Agreement is governed by the laws of India (or the parties' agreed jurisdiction) and may be signed electronically and in counterparts, with electronic signatures valid to the extent permitted by applicable law.",
        },
        {
          heading: "Please note",
          body:
            "This template is a professional starting point, not legal advice. Adapt the bracketed terms to your situation and jurisdiction, and consult a lawyer for high-value engagements.",
        },
      ],
    },
  },
  {
    id: "contract-msa",
    userId: null,
    templateType: "contract",
    title: "Master Services Agreement (MSA)",
    description:
      "Umbrella terms for an ongoing client relationship, with individual projects run through Statements of Work.",
    category: "msa",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Umbrella terms",
        "Works with SOWs",
        "IP & confidentiality",
        "Liability cap",
        "Term & termination",
      ],
      sections: [
        {
          heading: "Purpose and structure",
          body:
            "This Master Services Agreement (\"MSA\") between {{business_name}} (the \"Service Provider\") and {{client_name}} (the \"Client\") sets the general terms for all work between the parties. Each specific project is described in a separate Statement of Work (\"SOW\") that references this MSA. If an SOW conflicts with this MSA, the SOW controls for that project only.",
        },
        {
          heading: "Services and SOWs",
          body:
            "The Service Provider will perform the services described in each signed SOW, which will state the scope, deliverables, timeline, fees, and any project-specific terms. No work is authorised until the relevant SOW is signed by both parties.",
        },
        {
          heading: "Fees, taxes and payment",
          body:
            "Fees, rates, and the payment schedule are set in each SOW. Unless stated otherwise, invoices are due within [15] days. Applicable taxes (including GST where relevant) are additional, and third-party costs are billed at cost or paid directly by the Client. Overdue amounts may pause work and accrue interest at [1.5]% per month.",
        },
        {
          heading: "Intellectual property",
          body:
            "On full payment for a given SOW, the Client owns the final approved deliverables created for that project. The Service Provider retains pre-existing materials, tools, and reusable frameworks, licensed to the Client as needed to use the deliverables.",
        },
        {
          heading: "Confidentiality",
          body:
            "Each party protects the other's non-public information during the relationship and for [2] years afterward, using it only to perform the work. Standard exclusions apply for public or independently developed information.",
        },
        {
          heading: "Warranties and liability",
          body:
            "Services are performed with reasonable skill and care. Neither party is liable for indirect or consequential loss, and each party's aggregate liability is capped at the fees paid under the relevant SOW in the prior [3] months, except for confidentiality and IP breaches.",
        },
        {
          heading: "Term and termination",
          body:
            "This MSA continues until terminated by either party on [30] days' written notice, or immediately for an uncured material breach. Termination of the MSA does not end active SOWs unless expressly stated; the Client pays for work performed and approved expenses to the termination date.",
        },
        {
          heading: "Independent contractor and law",
          body:
            "The Service Provider is an independent contractor responsible for its own taxes and tools. This MSA is governed by the laws of India (or the parties' agreed jurisdiction) and may be executed electronically and in counterparts.",
        },
        {
          heading: "Please note",
          body:
            "This template is a professional starting point, not legal advice. Pair it with signed SOWs and adapt the bracketed terms for your situation and jurisdiction.",
        },
      ],
    },
  },
  {
    id: "contract-sow",
    userId: null,
    templateType: "contract",
    title: "Statement of Work (SOW)",
    description:
      "A project-specific scope document that sits under a Master Services Agreement.",
    category: "sow",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Under an MSA",
        "Deliverables & specs",
        "Milestones",
        "Acceptance criteria",
        "Change control",
      ],
      sections: [
        {
          heading: "Reference",
          body:
            "This Statement of Work (\"SOW\") for {{project_name}} is issued under, and incorporates, the Master Services Agreement between {{business_name}} and {{client_name}} dated [date]. Capitalised terms have the meaning given in the MSA.",
        },
        {
          heading: "Objectives",
          body:
            "The goal of this project is to [state the outcome the Client wants — e.g., launch a new marketing site that increases qualified enquiries]. Success looks like: [measurable outcome].",
        },
        {
          heading: "Deliverables and specifications",
          body:
            "The Service Provider will deliver: \n- [Deliverable 1 with quantity/spec]\n- [Deliverable 2]\n- [Deliverable 3]\nEach deliverable is complete when it meets the specification stated here and passes the acceptance criteria below.",
        },
        {
          heading: "Out of scope",
          body:
            "The following are not included and will be quoted separately if needed: [e.g., ongoing maintenance, content writing, paid media management, additional pages, third-party integrations].",
        },
        {
          heading: "Timeline and milestones",
          body:
            "Estimated schedule from kickoff: \n- Milestone 1 — [deliverable] — [week]\n- Milestone 2 — [deliverable] — [week]\n- Final delivery — [week]\nDates assume timely content, feedback, and access from the Client.",
        },
        {
          heading: "Fees and payment schedule",
          body:
            "Total fee for this SOW: {{currency}} [amount], plus applicable taxes. Payment: [50]% on signature, [30]% at Milestone [2], [20]% on final acceptance. Invoices are due within [15] days per the MSA.",
        },
        {
          heading: "Acceptance criteria",
          body:
            "The Client will review each deliverable within [5] business days and either accept it or provide specific, consolidated feedback. Deliverables not rejected in writing within that window are deemed accepted.",
        },
        {
          heading: "Assumptions and dependencies",
          body:
            "This SOW assumes: [Client provides final content by [date]; access to required accounts; a single decision-maker]. Delays in dependencies shift the timeline accordingly.",
        },
        {
          heading: "Change control",
          body:
            "Changes to this SOW's scope, deliverables, timeline, or fees are handled through a written change request approved by both parties before the additional work begins, under the MSA's change process.",
        },
      ],
    },
  },
  {
    id: "contract-nda-mutual",
    userId: null,
    templateType: "contract",
    title: "Mutual Non-Disclosure Agreement (NDA)",
    description:
      "Protects confidential information shared by both sides — useful before pitches, audits, or sharing proprietary work.",
    category: "nda",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Two-way protection",
        "Clear definition",
        "Exclusions",
        "Term & return",
        "Remedies",
      ],
      sections: [
        {
          heading: "Parties and purpose",
          body:
            "This Mutual Non-Disclosure Agreement is between {{business_name}} and {{client_name}} (each a \"Party\"). The parties wish to explore or carry out {{project_name}} (the \"Purpose\") and may share confidential information with each other for that Purpose only.",
        },
        {
          heading: "Confidential information",
          body:
            "\"Confidential Information\" means non-public information disclosed by one Party (the \"Discloser\") to the other (the \"Recipient\"), whether written, oral, or visual, that is marked confidential or would reasonably be understood as confidential — including business plans, pricing, designs, code, strategy, customer data, and processes.",
        },
        {
          heading: "Obligations",
          body:
            "The Recipient will: (a) use Confidential Information only for the Purpose; (b) protect it with at least reasonable care; (c) not disclose it to third parties except to team members or advisors who need it and are bound by similar obligations; and (d) not reverse-engineer or copy it beyond what the Purpose requires.",
        },
        {
          heading: "Exclusions",
          body:
            "These obligations do not apply to information that is or becomes public without breach, was already known to the Recipient, is independently developed without using the Confidential Information, or is rightfully received from a third party. Disclosure required by law is permitted with prompt notice to the Discloser where lawful.",
        },
        {
          heading: "Term and return",
          body:
            "This Agreement applies to information shared for [1] year from the date below, and confidentiality obligations continue for [2] years after disclosure. On request or when the Purpose ends, the Recipient will return or securely delete the Confidential Information, keeping only archival copies required by law.",
        },
        {
          heading: "No license, no obligation",
          body:
            "Nothing here grants any licence or ownership in the Confidential Information, nor obliges either Party to proceed with the Purpose or any transaction.",
        },
        {
          heading: "Remedies, law and execution",
          body:
            "The parties agree that a breach may cause harm for which damages alone are inadequate, so injunctive relief may be sought. This Agreement is governed by the laws of India (or the parties' agreed jurisdiction) and may be signed electronically and in counterparts.",
        },
        {
          heading: "Please note",
          body:
            "For a one-way NDA (only the Client's information is protected), keep the obligations on the Recipient and remove the mutual wording. This template is a starting point, not legal advice.",
        },
      ],
    },
  },
  {
    id: "contract-independent-contractor",
    userId: null,
    templateType: "contract",
    title: "Independent Contractor Agreement",
    description:
      "Confirms freelancer (non-employee) status with clear IP assignment and tax responsibility — common for foreign clients.",
    category: "contractor",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Contractor status",
        "IP assignment",
        "Own taxes",
        "Confidentiality",
        "Termination",
      ],
      sections: [
        {
          heading: "Engagement and status",
          body:
            "{{client_name}} (the \"Client\") engages {{business_name}} (the \"Contractor\") as an independent contractor for {{project_name}}. The Contractor is not an employee, partner, or agent of the Client, controls how the work is performed, and may work for others.",
        },
        {
          heading: "Services",
          body:
            "The Contractor will perform the services and deliverables described in the attached scope or SOW. The Contractor provides its own equipment and tools and may engage qualified subcontractors while remaining responsible for the work.",
        },
        {
          heading: "Compensation and taxes",
          body:
            "The Client pays the Contractor {{currency}} [amount / rate] per the agreed schedule. The Contractor is responsible for its own income tax, GST, and statutory filings, and is not entitled to employee benefits such as paid leave, insurance, or provident fund. For cross-border work, the Contractor confirms it is contracting as a business entity/self-employed provider.",
        },
        {
          heading: "Intellectual property",
          body:
            "On full payment, the Contractor assigns to the Client all rights in the deliverables created specifically for the Client under this Agreement. The Contractor retains pre-existing materials and reusable tools, licensed to the Client as needed to use the deliverables.",
        },
        {
          heading: "Confidentiality",
          body:
            "The Contractor keeps the Client's non-public information confidential during and for [2] years after the engagement, using it only to perform the services.",
        },
        {
          heading: "Term and termination",
          body:
            "This Agreement runs until the services are complete unless terminated earlier. Either party may terminate on [7] days' written notice, or immediately for an uncured material breach. On termination, the Client pays for work performed and approved expenses to date.",
        },
        {
          heading: "Liability and law",
          body:
            "Each party's liability (except for confidentiality and IP breaches) is limited to the fees paid under this Agreement. It is governed by the laws of India (or the parties' agreed jurisdiction) and may be executed electronically and in counterparts.",
        },
        {
          heading: "Please note",
          body:
            "Worker-classification rules vary by country. This template is a professional starting point, not legal or tax advice — adapt it and take local advice for cross-border engagements.",
        },
      ],
    },
  },
  {
    id: "contract-website-development",
    userId: null,
    templateType: "contract",
    title: "Website Development Agreement",
    description:
      "A detailed agreement for building and launching a website, covering hosting, content, testing, and third-party licenses.",
    category: "web-development",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Build scope",
        "Content & assets",
        "Testing & launch",
        "Third-party licenses",
        "Post-launch support",
      ],
      sections: [
        {
          heading: "Project scope",
          body:
            "{{business_name}} (the \"Developer\") will design, build, and launch a website for {{client_name}} covering: [number] pages/templates, responsive layouts, [CMS/framework], basic on-page SEO setup, and standard contact/lead forms. Features beyond this list are out of scope and quoted separately.",
        },
        {
          heading: "Technology and hosting",
          body:
            "The site will be built on [platform/stack] and deployed to [hosting/the Client's account]. Hosting, domains, and premium services are the Client's responsibility and billed at cost or paid directly by the Client unless included above.",
        },
        {
          heading: "Content and assets",
          body:
            "The Client provides final text, images, logos, and brand assets by [date], with rights to use them. If content is delayed, the timeline shifts accordingly. Placeholder content may be used to progress the build and replaced before launch.",
        },
        {
          heading: "Fees and milestones",
          body:
            "Total fee: {{currency}} [amount], plus applicable taxes. Payment: [40]% to start, [30]% at design approval, [30]% before launch. Third-party costs (themes, plugins, stock, fonts) are additional. Overdue amounts may pause work.",
        },
        {
          heading: "Revisions",
          body:
            "The fee includes [two] rounds of revisions at the design stage and [one] round at the build stage. Further changes or new requirements are billed at {{currency}} [rate] per hour or as a change request.",
        },
        {
          heading: "Testing and acceptance",
          body:
            "Before launch, the Developer tests the site across current versions of major browsers and common device sizes. The Client reviews on a staging link and provides consolidated feedback within [5] business days. The site is accepted on the Client's written approval or on go-live.",
        },
        {
          heading: "Launch and post-launch support",
          body:
            "After acceptance and full payment, the Developer launches the site and provides [14] days of post-launch support for defects in the delivered scope. New features, content changes, or ongoing maintenance are covered by a separate retainer or quoted as needed.",
        },
        {
          heading: "Intellectual property and licenses",
          body:
            "On full payment, the Client owns the final custom site files and design created for this project. Third-party components (themes, plugins, fonts, libraries, stock assets) remain under their own licenses, which the Client is responsible for maintaining. The Developer retains reusable code, tools, and frameworks.",
        },
        {
          heading: "Warranties, termination and law",
          body:
            "The Developer performs the work with reasonable skill and care but does not warrant error-free operation of third-party platforms. Either party may terminate on [7] days' notice or for an uncured material breach; the Client pays for work performed to date. Governed by the laws of India (or the parties' agreed jurisdiction); may be executed electronically.",
        },
        {
          heading: "Please note",
          body:
            "This template is a professional starting point, not legal advice. Adapt the bracketed terms and license responsibilities to your build and jurisdiction.",
        },
      ],
    },
  },
  {
    id: "contract-ip-assignment",
    userId: null,
    templateType: "contract",
    title: "IP Assignment & Content Licensing",
    description:
      "Cleanly transfers ownership of paid deliverables while licensing your reusable tools and protecting portfolio rights.",
    category: "ip-licensing",
    active: true,
    isSystem: true,
    updatedAt: null,
    content: {
      kind: "contract",
      highlights: [
        "Assignment on payment",
        "License-back of tools",
        "Client input warranties",
        "Portfolio rights",
        "Moral rights",
      ],
      sections: [
        {
          heading: "Purpose",
          body:
            "This Agreement sets out how intellectual property in the deliverables for {{project_name}} passes between {{business_name}} (the \"Creator\") and {{client_name}} (the \"Client\"). It applies alongside any services or project agreement between the parties.",
        },
        {
          heading: "Assignment of deliverables",
          body:
            "Upon receipt of full and final payment, the Creator assigns to the Client all rights, title, and interest in the final approved deliverables created specifically for the Client under this project. Until full payment, all rights remain with the Creator, and any use before payment is unlicensed.",
        },
        {
          heading: "Pre-existing and third-party materials",
          body:
            "The Creator retains ownership of pre-existing works, source tooling, reusable frameworks, and general know-how (\"Creator Materials\"). To the extent Creator Materials or licensed third-party assets (fonts, stock, plugins) are embedded in the deliverables, the Creator grants the Client a non-exclusive, perpetual licence to use them as part of the deliverables. Third-party assets remain subject to their own licenses.",
        },
        {
          heading: "Client warranties on inputs",
          body:
            "The Client confirms it owns or is licensed to use all content, brand assets, and materials it provides, and that their use in the deliverables will not infringe any third-party rights. The Client indemnifies the Creator against claims arising from Client-supplied materials.",
        },
        {
          heading: "Moral rights and credit",
          body:
            "To the extent permitted by law, the Creator waives moral rights in the assigned deliverables so the Client can adapt and use them freely. The Client is not obliged to credit the Creator, and the Creator may credit itself only as permitted under portfolio rights below.",
        },
        {
          heading: "Portfolio and license-back",
          body:
            "Unless the Client requests otherwise in writing, the Creator may display the completed, non-confidential deliverables in its portfolio and marketing and describe its role. The Client grants the Creator a limited licence to use the deliverables for that purpose only.",
        },
        {
          heading: "Confidentiality, law and execution",
          body:
            "Each party keeps the other's non-public information confidential. This Agreement is governed by the laws of India (or the parties' agreed jurisdiction) and may be signed electronically and in counterparts.",
        },
        {
          heading: "Please note",
          body:
            "This template is a professional starting point, not legal advice. Review the assignment, licence-back, and indemnity terms for high-value or brand-critical work.",
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
];
