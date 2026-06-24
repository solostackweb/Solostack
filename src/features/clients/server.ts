import "server-only";

/**
 * Server-side client persistence layer.
 *
 * All reads + writes go through the request-scoped Supabase client so RLS
 * enforces tenant isolation. We expose a small number of focused helpers
 * — UI layers should compose these rather than re-querying the table.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/supabase/types";
import { rpcClientInvoiceMetrics } from "@/lib/supabase/rpc";

/**
 * View-model exposed to UI code. Camel-cased + GST-aware.
 */
export interface ClientRecord {
  id: string;
  fullName: string;
  businessName: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  currency: string;
  locale: string | null;
  isForeign: boolean;
  gstRegistered: boolean;
  gstin: string | null;
  stateCode: string | null;
  billingAddress: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapClientRow(row: ClientRow): ClientRecord {
  const intl = row as unknown as {
    country?: string | null;
    currency?: string | null;
    locale?: string | null;
    is_foreign?: boolean | null;
  };
  return {
    id: row.id,
    fullName: row.full_name,
    businessName: row.business_name ?? row.company_name,
    email: row.email,
    phone: row.phone,
    country: intl.country ?? "IN",
    currency: intl.currency ?? "INR",
    locale: intl.locale ?? null,
    isForeign: intl.is_foreign ?? false,
    gstRegistered: row.gst_registered,
    gstin: row.gst_number,
    stateCode: row.state_code,
    billingAddress: row.billing_address ?? row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListClientsOptions {
  search?: string;
  /** Hard cap to keep payloads bounded. Defaults to 200. */
  limit?: number;
}

/**
 * List the authenticated user's clients, newest first. `search` matches on
 * full_name / business_name / email (case-insensitive substring).
 */
export async function listClients(
  options: ListClientsOptions = {},
): Promise<ClientRecord[]> {
  const supabase = await getServerSupabase();
  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 200);

  if (options.search && options.search.trim().length > 0) {
    const term = options.search.trim().replace(/[%,]/g, "");
    query = query.or(
      `full_name.ilike.%${term}%,business_name.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as ClientRow[]).map(mapClientRow);
}

/**
 * Fetch a single client owned by the authenticated user. Returns null if
 * the row doesn't exist or RLS blocks access.
 */
export async function getClient(id: string): Promise<ClientRecord | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapClientRow(data as unknown as ClientRow);
}

/**
 * Per-client paid invoice rollup used by the profile page. Invoices are
 * generated after payment in the simplified workflow, so receivables do not
 * belong in this metric.
 */
export async function getClientInvoiceMetrics(clientId: string): Promise<{
  invoiceCount: number;
  paidTotal: number;
}> {
  const supabase = await getServerSupabase();
  // Delegate the count+sum to Postgres via `client_invoice_metrics` (see
  // migration 0016). RLS still narrows to the caller's rows because the
  // function is `security invoker`.
  const rows = await rpcClientInvoiceMetrics(supabase, {
    p_client_id: clientId,
  });
  const row = rows[0];
  return {
    invoiceCount: Number(row?.invoice_count ?? 0),
    paidTotal: Math.round(Number(row?.paid_total ?? 0) * 100) / 100,
  };
}

/**
 * Aggregations for dashboard tiles. Cheap because RLS bounds the row count
 * to the user's own data.
 */
export async function getClientAggregates(): Promise<{
  total: number;
  gstClients: number;
  recent: ClientRecord[];
}> {
  const supabase = await getServerSupabase();
  const [{ count: total }, { count: gstClients }, { data: recentRows }] =
    await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("gst_registered", true),
      supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return {
    total: total ?? 0,
    gstClients: gstClients ?? 0,
    recent: ((recentRows as unknown as ClientRow[]) ?? []).map(mapClientRow),
  };
}
