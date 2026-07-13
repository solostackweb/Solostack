import type { ProposalStatusRow } from "@/lib/supabase/types";

export const PROPOSAL_STATUSES: ProposalStatusRow[] = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "converted",
];

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatusRow, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted",
};

export const PROPOSAL_STATUS_CLASS: Record<ProposalStatusRow, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  sent: "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  viewed: "border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  accepted: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  declined: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300",
  expired: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  converted: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
};
