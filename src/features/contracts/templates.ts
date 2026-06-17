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
        body: "This proposal outlines a phased approach to redesign your website, with a focus on improving conversion and establishing a reusable design system.",
      },
      {
        id: "s2",
        heading: "Scope of work",
        body: "Discovery workshop, content audit, wireframes, high-fidelity designs (up to 8 templates), implementation on your CMS, and a go-live review.",
      },
      {
        id: "s3",
        heading: "Timeline",
        body: "Approximately 8 weeks from kickoff to launch: 1 week discovery, 3 weeks design, 3 weeks build, 1 week QA + launch.",
      },
      {
        id: "s4",
        heading: "Investment",
        body: "Total: Add project fee here. Payment schedule: define the kickoff, milestone, and final payment terms.",
      },
      {
        id: "s5",
        heading: "Next steps",
        body: "Sign below to accept this proposal. Once accepted, we'll send a detailed Statement of Work and schedule the kickoff call.",
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
        body: "This retainer covers up to 20 hours per month of design + development support, including minor feature additions, bug fixes, content updates, and monthly performance reviews.",
      },
      {
        id: "s2",
        heading: "Unused hours",
        body: "Up to 5 unused hours roll over to the next month. Rollover hours expire after 60 days.",
      },
      {
        id: "s3",
        heading: "Fees and billing",
        body: "INR 50,000 per month, invoiced on the 1st, due net-15. Additional hours beyond the scope are billed at INR 3,500 per hour.",
      },
      {
        id: "s4",
        heading: "Term and cancellation",
        body: "Either party may cancel with 30 days written notice. Prepaid fees are non-refundable.",
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
        body: "A clear one-paragraph description of the work being performed under this SOW.",
      },
      {
        id: "s2",
        heading: "Deliverables",
        body: "Bulleted list of concrete deliverables, each with an acceptance criterion.",
      },
      {
        id: "s3",
        heading: "Schedule",
        body: "Start date, end date, and major milestone dates.",
      },
      {
        id: "s4",
        heading: "Fees",
        body: "Fixed fee or hourly structure, invoicing cadence, and payment terms.",
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
        body: "Both parties agree that any non-public information shared during the course of this engagement will be treated as confidential.",
      },
      {
        id: "s2",
        heading: "Obligations",
        body: "Each party will protect the other's confidential information with the same care it uses to protect its own, and will not disclose it to third parties without written consent.",
      },
      {
        id: "s3",
        heading: "Term",
        body: "Obligations under this agreement survive for 2 years after the termination of the engagement.",
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
        body: "Services will be described in one or more Statements of Work executed under this MSA.",
      },
      {
        id: "s2",
        heading: "Intellectual property",
        body: "Upon full payment, the Client receives all rights to the final deliverables. The Freelancer retains rights to any pre-existing tools, techniques, and reusable frameworks.",
      },
      {
        id: "s3",
        heading: "Limitation of liability",
        body: "Each party's total liability is capped at the fees paid under the applicable SOW in the 12 months preceding the claim.",
      },
      {
        id: "s4",
        heading: "Governing law",
        body: "This agreement is governed by the laws of India and disputes will be resolved in the courts of Bengaluru.",
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
