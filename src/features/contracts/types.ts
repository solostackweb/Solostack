export type ContractStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "signed"
  | "declined"
  | "expired";

export type ContractKind = "proposal" | "contract" | "msa" | "nda" | "sow";

export const CONTRACT_STATUSES: ContractStatus[] = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
];

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
};

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  proposal: "Proposal",
  contract: "Contract",
  msa: "Master Services Agreement",
  nda: "NDA",
  sow: "Statement of Work",
};

export interface ContractSigner {
  id: string;
  name: string;
  email: string;
  role: "client" | "freelancer";
  /** "signed" means this person has signed. */
  status: "pending" | "viewed" | "signed" | "declined";
  signedAt?: string;
}

export interface ContractSection {
  id: string;
  heading: string;
  body: string;
}

export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  kind: ContractKind;
  /** Short list of sections shown on the card for a quick preview. */
  highlights: string[];
  sections: ContractSection[];
  /** Estimated reading time in minutes, shown on the picker card. */
  readingTime: number;
  popular?: boolean;
}

export interface Contract {
  id: string;
  /** Human-facing identifier — e.g. "CTR-0012". */
  number: string;
  title: string;
  kind: ContractKind;
  status: ContractStatus;
  clientId: string;
  projectId?: string;
  templateId?: string;
  /** Total contract value in `currency` (nullable for NDAs etc.). */
  value?: number;
  currency?: string;
  sections: ContractSection[];
  signers: ContractSigner[];
  /** Issued date — YYYY-MM-DD. */
  issuedAt: string;
  /** Expires date — optional. */
  expiresAt?: string;
  signedAt?: string;
  /** Short description for the list page. */
  summary?: string;
}
