import type { ContractTemplate } from "./types";

export const contractTemplates: ContractTemplate[] = [
  {
    id: "tpl_web_design",
    name: "Web design proposal",
    description:
      "Scope, timeline, and pricing for a full website project. Covers discovery, design, build, and launch.",
    kind: "proposal",
    highlights: ["Project scope", "Timeline", "Investment", "Next steps"],
    readingTime: 6,
    popular: true,
    sections: [
      {
        id: "s1",
        heading: "Overview",
        body: "This proposal outlines the work for [client/project name]. The goal is to [primary business goal], improve [key metric or user experience], and deliver a website that is easier to maintain after launch.\n\nThis proposal is a starting point for approval. Please review each section, replace every bracketed placeholder, and confirm the scope before sending.",
      },
      {
        id: "s2",
        heading: "Scope of work",
        body: "The project includes:\n\n- Discovery and requirements review for [project goal]\n- Sitemap and content structure for [number] pages\n- Wireframes for [number] key page templates\n- High-fidelity design in [Figma/other tool]\n- Development or handoff for [platform/CMS]\n- Basic responsive QA across desktop and mobile\n- Launch support for [number] business days after go-live\n\nNot included unless added in writing: copywriting, paid fonts, third-party subscriptions, hosting fees, advanced SEO, photography, custom illustrations, or integrations beyond [listed integrations].",
      },
      {
        id: "s3",
        heading: "Timeline",
        body: "Estimated timeline: [number] weeks from kickoff, assuming feedback and materials arrive on time.\n\n- Kickoff and discovery: [date/range]\n- First design direction: [date/range]\n- Design revisions: [date/range]\n- Build or handoff: [date/range]\n- QA and launch: [date/range]\n\nIf feedback, approvals, content, or access are delayed, the delivery timeline may shift by the same amount.",
      },
      {
        id: "s4",
        heading: "Investment",
        body: "Project fee: [currency and amount].\n\nPayment schedule:\n\n- [percentage]% upfront to reserve the project slot and begin work\n- [percentage]% after [milestone]\n- [percentage]% before final delivery or launch\n\nInvoices are payable within [number] days. Work may pause if an invoice becomes overdue.",
      },
      {
        id: "s5",
        heading: "Next steps",
        body: "To proceed:\n\n1. Review this proposal carefully and replace any remaining placeholders.\n2. Confirm the final scope, timeline, and fee.\n3. Sign below to accept the proposal.\n4. Share [assets/content/access] before the kickoff call on [date].\n\nOnce signed, I will issue the kickoff invoice and schedule the project start.",
      },
      {
        id: "s_esign",
        heading: "Electronic execution",
        body: "This agreement may be signed electronically and in counterparts. Electronic signatures and an electronic copy are valid, binding, and admissible to the same extent as handwritten signatures under applicable law (including the Information Technology Act, 2000 in India, and the ESIGN Act / UETA or eIDAS where relevant). The signing record - including timestamp and audit trail - forms part of this agreement.",
      },
    ],
  },
  {
    id: "tpl_retainer",
    name: "Monthly retainer agreement",
    description:
      "Ongoing support retainer. Fixed monthly fee, rollover hours, 30-day cancellation.",
    kind: "contract",
    highlights: ["Monthly scope", "Rollover hours", "Cancellation"],
    readingTime: 4,
    sections: [
      {
        id: "s1",
        heading: "Retainer scope",
        body: "This retainer covers recurring support for [client/business name]. The monthly scope includes up to [number] hours per month for [design/development/content/strategy] support.\n\nTypical work may include:\n\n- Minor feature additions or design updates\n- Content or page updates\n- Bug fixes and maintenance\n- Advisory calls or async recommendations\n- Monthly reporting or performance review\n\nAnything outside the monthly scope will be estimated and approved separately before work begins.",
      },
      {
        id: "s2",
        heading: "Availability and requests",
        body: "Requests should be submitted through [email/portal/project tool]. I will confirm priority, estimated effort, and expected delivery before starting.\n\nStandard response time is [number] business day(s). Rush requests, weekend work, or emergency support are not included unless specifically agreed in writing.",
      },
      {
        id: "s3",
        heading: "Fees and billing",
        body: "Monthly retainer fee: [currency and amount].\n\nBilling terms:\n\n- Invoiced on: [day of month]\n- Payment due within: [number] days\n- Additional work rate: [currency and amount] per hour/day\n- Unused hours: [roll over / do not roll over] for [number] days\n\nWork may pause if payment is overdue by more than [number] days.",
      },
      {
        id: "s4",
        heading: "Term and cancellation",
        body: "This retainer begins on [start date] and continues monthly until cancelled.\n\nEither party may cancel with [number] days written notice. Prepaid fees are [refundable/non-refundable] except where required by law. On cancellation, I will hand over completed work and any relevant files up to the paid-through date.",
      },
      {
        id: "s5",
        heading: "Client responsibilities",
        body: "To keep the retainer productive, the client will provide timely access, approvals, content, brand assets, and a single decision-maker for priority calls.\n\nDelays in approvals, missing access, or unclear requests may affect delivery timelines.",
      },
      {
        id: "s_gov",
        heading: "Governing law & jurisdiction",
        body: "This agreement is governed by the laws of India. The parties will first try to resolve any dispute in good faith; if unresolved, the courts at [your city], India will have jurisdiction. If you and your client agree on a different governing law or seat, edit this clause.",
      },
      {
        id: "s_esign",
        heading: "Electronic execution",
        body: "This agreement may be signed electronically and in counterparts. Electronic signatures and an electronic copy are valid, binding, and admissible to the same extent as handwritten signatures under applicable law (including the Information Technology Act, 2000 in India, and the ESIGN Act / UETA or eIDAS where relevant). The signing record - including timestamp and audit trail - forms part of this agreement.",
      },
    ],
  },
  {
    id: "tpl_sow",
    name: "Statement of Work",
    description: "Detailed SOW for a specific project within an existing MSA.",
    kind: "sow",
    highlights: ["Deliverables", "Acceptance criteria", "Schedule"],
    readingTime: 3,
    sections: [
      {
        id: "s1",
        heading: "Project summary",
        body: "This Statement of Work describes the services for [project name] between [freelancer/business name] and [client name].\n\nThe objective is to [primary outcome]. This SOW should be read together with the Master Services Agreement dated [MSA date], if applicable. If there is any conflict, [this SOW / the MSA] will control for project-specific details.",
      },
      {
        id: "s2",
        heading: "Deliverables",
        body: "The deliverables are:\n\n- [Deliverable 1] - acceptance criteria: [how client approves it]\n- [Deliverable 2] - acceptance criteria: [how client approves it]\n- [Deliverable 3] - acceptance criteria: [how client approves it]\n\nDeliverables not listed here are excluded unless added through a written change request.",
      },
      {
        id: "s3",
        heading: "Schedule",
        body: "Project schedule:\n\n- Start date: [date]\n- Milestone 1: [description and date]\n- Milestone 2: [description and date]\n- Final delivery: [date]\n\nDates depend on timely feedback, content, approvals, and access from the client. Material delays may move the timeline.",
      },
      {
        id: "s4",
        heading: "Fees and payment terms",
        body: "Fee structure: [fixed fee / hourly / milestone based].\n\nTotal estimated fee: [currency and amount].\n\nPayment schedule:\n\n- [percentage/amount] due on signing\n- [percentage/amount] due at [milestone]\n- [percentage/amount] due before final handoff\n\nInvoices are due within [number] days of issue.",
      },
      {
        id: "s5",
        heading: "Change requests",
        body: "A change request is any work that changes the agreed scope, deliverables, timeline, or assumptions in this SOW.\n\nChange requests must be approved in writing before work begins. I will provide the impact on fee and timeline before starting additional work.",
      },
      {
        id: "s6",
        heading: "Acceptance",
        body: "The client will review each deliverable within [number] business days. If no written feedback is received within that period, the deliverable may be treated as accepted.\n\nReasonable revisions are included only as described in this SOW. New direction, new deliverables, or post-approval changes may be billed separately.",
      },
      {
        id: "s_gov",
        heading: "Governing law & jurisdiction",
        body: "This agreement is governed by the laws of India. The parties will first try to resolve any dispute in good faith; if unresolved, the courts at [your city], India will have jurisdiction. If you and your client agree on a different governing law or seat, edit this clause.",
      },
      {
        id: "s_esign",
        heading: "Electronic execution",
        body: "This agreement may be signed electronically and in counterparts. Electronic signatures and an electronic copy are valid, binding, and admissible to the same extent as handwritten signatures under applicable law (including the Information Technology Act, 2000 in India, and the ESIGN Act / UETA or eIDAS where relevant). The signing record - including timestamp and audit trail - forms part of this agreement.",
      },
    ],
  },
  {
    id: "tpl_nda",
    name: "Mutual NDA",
    description: "Short, plain-English mutual non-disclosure agreement.",
    kind: "nda",
    highlights: ["Definitions", "Obligations", "Term"],
    readingTime: 2,
    sections: [
      {
        id: "s1",
        heading: "Confidential information",
        body: "This Mutual Non-Disclosure Agreement is between [party one legal name] and [party two legal name].\n\nConfidential Information means non-public information disclosed by either party in connection with [project/opportunity], including business plans, pricing, strategy, client lists, technical information, product ideas, designs, documents, credentials, financial information, and any information marked or reasonably understood as confidential.",
      },
      {
        id: "s2",
        heading: "Obligations",
        body: "Each party agrees to:\n\n- Use Confidential Information only for [permitted purpose]\n- Protect it with reasonable care\n- Not disclose it to third parties without written permission\n- Limit access to people who need to know it for the permitted purpose\n- Promptly notify the other party of any suspected unauthorised disclosure",
      },
      {
        id: "s3",
        heading: "Exclusions",
        body: "Confidential Information does not include information that:\n\n- Is publicly available through no fault of the receiving party\n- Was already known before disclosure\n- Is independently developed without using Confidential Information\n- Is lawfully received from another source without a confidentiality duty\n- Must be disclosed by law, court order, or regulator, provided notice is given where legally allowed",
      },
      {
        id: "s4",
        heading: "Term",
        body: "This agreement starts on [effective date]. Confidentiality obligations continue for [number] years from the date of disclosure, except trade secrets or highly sensitive information, which remain protected as long as permitted by law.",
      },
      {
        id: "s5",
        heading: "Return or destruction",
        body: "On request, each party will return or destroy Confidential Information, except copies retained in backups, legal archives, or records required by law. Any retained copies remain subject to this agreement.",
      },
      {
        id: "s6",
        heading: "No licence or obligation",
        body: "Sharing Confidential Information does not grant ownership, licence, partnership, employment, or obligation to proceed with any transaction or project unless separately agreed in writing.",
      },
      {
        id: "s_gov",
        heading: "Governing law & jurisdiction",
        body: "This agreement is governed by the laws of India. The parties will first try to resolve any dispute in good faith; if unresolved, the courts at [your city], India will have jurisdiction. If you and your client agree on a different governing law or seat, edit this clause.",
      },
      {
        id: "s_esign",
        heading: "Electronic execution",
        body: "This agreement may be signed electronically and in counterparts. Electronic signatures and an electronic copy are valid, binding, and admissible to the same extent as handwritten signatures under applicable law (including the Information Technology Act, 2000 in India, and the ESIGN Act / UETA or eIDAS where relevant). The signing record - including timestamp and audit trail - forms part of this agreement.",
      },
    ],
  },
  {
    id: "tpl_msa",
    name: "Master Services Agreement",
    description:
      "Umbrella agreement covering the legal terms of the relationship. Individual SOWs sit under this MSA.",
    kind: "msa",
    highlights: ["IP ownership", "Liability", "Governing law"],
    readingTime: 8,
    sections: [
      {
        id: "s1",
        heading: "Services",
        body: "This Master Services Agreement governs services provided by [freelancer/business legal name] to [client legal name].\n\nSpecific work will be described in one or more Statements of Work, proposals, or written approvals. Each SOW should list deliverables, timeline, fees, assumptions, and acceptance criteria.",
      },
      {
        id: "s2",
        heading: "Intellectual property",
        body: "After full payment, the client owns the final approved deliverables created specifically for the client under the relevant SOW.\n\nI retain ownership of pre-existing materials, reusable tools, templates, code snippets, know-how, processes, libraries, and general skills developed before or outside the engagement. Where such materials are included in a deliverable, the client receives a licence to use them as part of that deliverable for [permitted use].",
      },
      {
        id: "s3",
        heading: "Fees, invoicing, and taxes",
        body: "Fees are set out in each SOW. Unless stated otherwise:\n\n- Invoices are due within [number] days\n- Late payments may pause work\n- Taxes, platform fees, paid tools, stock assets, hosting, and third-party costs are charged separately if applicable\n- Expenses must be approved in writing before they are incurred",
      },
      {
        id: "s4",
        heading: "Client responsibilities",
        body: "The client will provide timely access, information, content, approvals, feedback, brand assets, and decision-makers required to complete the work.\n\nIf client-side delays affect delivery, the timeline and fees may be adjusted in good faith.",
      },
      {
        id: "s5",
        heading: "Confidentiality",
        body: "Both parties will protect confidential information shared during the engagement and use it only for the agreed work. This includes business, technical, financial, client, strategy, product, and access information that is non-public or reasonably understood as confidential.",
      },
      {
        id: "s6",
        heading: "Limitation of liability",
        body: "To the maximum extent permitted by law, each party's total liability under this agreement is limited to [amount / fees paid under the relevant SOW in the previous number months]. Neither party is liable for indirect, incidental, special, consequential, or lost-profit damages, except for confidentiality breaches, unpaid fees, or wilful misconduct.",
      },
      {
        id: "s7",
        heading: "Term and termination",
        body: "This agreement starts on [effective date] and continues until terminated. Either party may terminate with [number] days written notice.\n\nOn termination, the client will pay for all approved work, work in progress, and non-cancellable third-party costs incurred up to the termination date.",
      },
      {
        id: "s8",
        heading: "Governing law & jurisdiction",
        body: "This agreement is governed by the laws of India. The parties will first try to resolve disputes in good faith; if unresolved, the courts at [your city], India will have jurisdiction. If you and your client agree on a different governing law or seat, edit this clause.",
      },
      {
        id: "s_esign",
        heading: "Electronic execution",
        body: "This agreement may be signed electronically and in counterparts. Electronic signatures and an electronic copy are valid, binding, and admissible to the same extent as handwritten signatures under applicable law (including the Information Technology Act, 2000 in India, and the ESIGN Act / UETA or eIDAS where relevant). The signing record - including timestamp and audit trail - forms part of this agreement.",
      },
    ],
  },
  {
    id: "tpl_blank",
    name: "Blank document",
    description: "Start with an empty canvas. Add your own sections.",
    kind: "contract",
    highlights: ["Empty", "Fully custom"],
    readingTime: 0,
    sections: [
      {
        id: "s1",
        heading: "Untitled section",
        body: "",
      },
    ],
  },
];

export function getContractTemplateById(id: string) {
  return contractTemplates.find((template) => template.id === id);
}
