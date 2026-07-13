import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  ProposalItemRow,
  ProposalRow,
  ProposalStatusRow,
} from "@/lib/supabase/types";

export interface ProposalRecord {
  id: string;
  title: string;
  clientId: string | null;
  projectId: string | null;
  status: ProposalStatusRow;
  currency: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  validUntil: string | null;
  scope: string | null;
  deliverables: string | null;
  timeline: string | null;
  terms: string | null;
  publicToken: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalItemRecord {
  id: string;
  proposalId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function mapProposalRow(row: ProposalRow): ProposalRecord {
  return {
    id: row.id,
    title: row.title,
    clientId: row.client_id,
    projectId: row.project_id,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    validUntil: row.valid_until,
    scope: row.scope,
    deliverables: row.deliverables,
    timeline: row.timeline,
    terms: row.terms,
    publicToken: row.public_token,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProposalItemRow(row: ProposalItemRow): ProposalItemRecord {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    description: row.description,
    quantity: Number(row.quantity ?? 1),
    unitPrice: Number(row.unit_price ?? 0),
    amount: Number(row.amount ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListProposalsOptions {
  status?: ProposalStatusRow | "all";
  clientId?: string;
  projectId?: string;
  search?: string;
  limit?: number;
}

export async function listProposals(
  options: ListProposalsOptions = {},
): Promise<ProposalRecord[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.status && options.status !== "all") q = q.eq("status", options.status);
  if (options.clientId) q = q.eq("client_id", options.clientId);
  if (options.projectId) q = q.eq("project_id", options.projectId);
  if (options.search?.trim()) {
    const term = options.search.trim().replace(/[%,]/g, "");
    q = q.ilike("title", `%${term}%`);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as ProposalRow[]).map(mapProposalRow);
}

export async function getProposal(id: string): Promise<ProposalRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapProposalRow(data as unknown as ProposalRow);
}

export async function listProposalItems(proposalId: string): Promise<ProposalItemRecord[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("proposal_items")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });
  if (error || !data) return [];
  return (data as unknown as ProposalItemRow[]).map(mapProposalItemRow);
}

export async function getProposalWithItems(
  id: string,
): Promise<{ proposal: ProposalRecord; items: ProposalItemRecord[] } | null> {
  const proposal = await getProposal(id);
  if (!proposal) return null;
  const items = await listProposalItems(id);
  return { proposal, items };
}
