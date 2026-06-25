import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  ContractKindRow,
  ContractRow,
  ContractStatusRow,
  Json,
} from "@/lib/supabase/types";

export interface ContractRecord {
  id: string;
  kind: ContractKindRow;
  title: string;
  content: string | null;
  clientId: string | null;
  projectId: string | null;
  status: ContractStatusRow;
  currency: string;
  valueAmount: number | null;
  fxRateToInr: number;
  inrEquivalent: number | null;
  publicToken: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  declinedAt: string | null;
  expiresAt: string | null;
  signatureType: "draw" | "type" | "upload" | null;
  signatureImageUrl: string | null;
  signatureTextValue: string | null;
  signatureFontFamily: string | null;
  signatureMetadata: Json | null;
  pdfSnapshotUrl: string | null;
  pdfSnapshotHash: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapContractRow(row: ContractRow): ContractRecord {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    clientId: row.client_id,
    projectId: row.project_id,
    status: row.status,
    currency: row.currency,
    valueAmount: row.value_amount,
    fxRateToInr: row.fx_rate_to_inr ?? 1,
    inrEquivalent: row.inr_equivalent ?? null,
    publicToken: row.public_token,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    declinedAt: row.declined_at,
    expiresAt: row.expires_at,
    signatureType: row.signature_type,
    signatureImageUrl: row.signature_image_url,
    signatureTextValue: row.signature_text_value,
    signatureFontFamily: row.signature_font_family,
    signatureMetadata: row.signature_metadata,
    pdfSnapshotUrl: row.pdf_snapshot_url,
    pdfSnapshotHash: row.pdf_snapshot_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListContractsOptions {
  kind?: ContractKindRow | "all";
  status?: ContractStatusRow | "all";
  clientId?: string;
  projectId?: string;
  search?: string;
  limit?: number;
}

export async function listContracts(
  opts: ListContractsOptions = {},
): Promise<ContractRecord[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.kind && opts.kind !== "all") q = q.eq("kind", opts.kind);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.search?.trim()) {
    const term = opts.search.trim().replace(/[%,]/g, "");
    q = q.ilike("title", `%${term}%`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as ContractRow[]).map(mapContractRow);
}

export async function getContract(id: string): Promise<ContractRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapContractRow(data as unknown as ContractRow);
}

export async function getContractByPublicToken(
  token: string,
): Promise<ContractRecord | null> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!data) return null;
  return mapContractRow(data as unknown as ContractRow);
}

export async function getContractAggregates(): Promise<{
  drafts: number;
  awaitingSignature: number;
  signed: number;
  signedValue: number;
  awaitingValue: number;
}> {
  const supabase = await getServerSupabase();
  const [
    { count: drafts },
    { count: awaiting },
    { count: signed },
    { data: signedRows },
    { data: awaitingRows },
  ] =
    await Promise.all([
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "viewed"]),
      supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("status", "signed"),
      supabase
        .from("contracts")
        .select("value_amount, inr_equivalent")
        .eq("status", "signed"),
      supabase
        .from("contracts")
        .select("value_amount, inr_equivalent")
        .in("status", ["sent", "viewed"]),
    ]);
  const sum = (
    rows: Array<{ value_amount?: number | null; inr_equivalent?: number | null }> | null,
  ) =>
    (rows ?? []).reduce(
      (acc, r) => acc + (Number(r.inr_equivalent ?? r.value_amount) || 0),
      0,
    );
  return {
    drafts: drafts ?? 0,
    awaitingSignature: awaiting ?? 0,
    signed: signed ?? 0,
    signedValue: sum(
      signedRows as Array<{
        value_amount?: number | null;
        inr_equivalent?: number | null;
      }> | null,
    ),
    awaitingValue: sum(
      awaitingRows as Array<{
        value_amount?: number | null;
        inr_equivalent?: number | null;
      }> | null,
    ),
  };
}
