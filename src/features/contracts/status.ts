/**
 * Canonical labels + ordering for the DB `contract_status` and
 * `contract_kind` enums. Dependency-free so server + client can both import.
 */

import type {
  ContractKindRow,
  ContractStatusRow,
} from "@/lib/supabase/types";

export const CONTRACT_STATUSES: ContractStatusRow[] = [
  "draft",
  "sent",
  "viewed",
  "signed",
  "declined",
  "expired",
];

export const CONTRACT_STATUS_LABEL: Record<ContractStatusRow, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
};

// Proposals are now their own document type, so the contract builder only
// offers "contract". The "proposal" label is kept below for any legacy rows.
export const CONTRACT_KINDS: ContractKindRow[] = ["contract"];

export const CONTRACT_KIND_LABEL: Record<ContractKindRow, string> = {
  proposal: "Proposal",
  contract: "Contract",
};

/**
 * Client-facing contract status label. Internal pre-signature states
 * (draft/sent/viewed) all read as "Awaiting signature". Used by the public
 * signing page and the client portal for consistency.
 */
export function clientFacingContractStatus(status: string): string {
  switch (status) {
    case "signed":
      return "Signed";
    case "declined":
      return "Declined";
    case "expired":
      return "Expired";
    default:
      return "Awaiting signature";
  }
}
