import "server-only";

/**
 * Pulse analytics service.
 *
 * All queries are RLS-scoped (the user only sees their own rows) and
 * deliberately avoid expensive joins. Invoices are generated after payment in
 * the simplified Stackivo workflow, so Pulse tracks paid revenue instead of
 * receivable invoice balances.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/lib/supabase/types";
import {
  rpcClientRevenueSummary,
  rpcInvoiceStatusSummary,
} from "@/lib/supabase/rpc";

export interface RevenuePoint {
  /** YYYY-MM (UTC). */
  month: string;
  paid: number;
}

export interface ClientRevenueRow {
  clientId: string | null;
  totalPaid: number;
  invoiceCount: number;
}

export interface PaidInvoiceSummary {
  count: number;
  total: number;
}

/**
 * Monthly paid totals across the last `months` calendar months
 * (inclusive of the current).
 */
export async function getRevenueSeries(months = 6): Promise<RevenuePoint[]> {
  const supabase = await getServerSupabase();
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const { data } = await supabase
    .from("invoices")
    .select("issue_date, paid_at, total_amount, inr_equivalent, status")
    .gte("issue_date", start.toISOString().slice(0, 10));

  type Row = Pick<InvoiceRow, "issue_date" | "paid_at" | "total_amount" | "status"> & {
    inr_equivalent?: number | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  const buckets = new Map<string, RevenuePoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, { month: key, paid: 0 });
  }

  for (const r of rows) {
    if (r.status !== "paid" || !r.paid_at) continue;
    const total = Number(r.inr_equivalent ?? r.total_amount) || 0;
    const d = new Date(r.paid_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.paid += total;
  }

  return Array.from(buckets.values()).map((b) => ({
    month: b.month,
    paid: Math.round(b.paid * 100) / 100,
  }));
}

/**
 * Sum + count of invoices in a given status. Delegates to the
 * `invoice_status_summary` Postgres function (see migration 0016) so the
 * aggregation runs server-side instead of pulling every row into JS.
 */
async function getInvoiceStatusSummary(
  status: string,
): Promise<PaidInvoiceSummary> {
  const supabase = await getServerSupabase();
  const rows = await rpcInvoiceStatusSummary(supabase, { p_status: status });
  const row = rows[0];
  return {
    count: Number(row?.invoice_count ?? 0),
    total: Math.round(Number(row?.total_amount ?? 0) * 100) / 100,
  };
}

export async function getOverdueTotal(): Promise<{
  total: number;
  count: number;
}> {
  const supabase = await getServerSupabase();
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("invoices")
    .select("total_amount, inr_equivalent")
    .in("status", ["sent", "viewed", "overdue"])
    .lte("due_date", todayIso);

  const rows =
    (data as Array<{ total_amount: number | null; inr_equivalent?: number | null }> | null) ??
    [];
  return {
    count: rows.length,
    total:
      Math.round(
        rows.reduce((sum, row) => sum + (Number(row.inr_equivalent ?? row.total_amount) || 0), 0) *
          100,
      ) / 100,
  };
}

export async function getPaidInvoiceSummary(): Promise<PaidInvoiceSummary> {
  return getInvoiceStatusSummary("paid");
}

/**
 * Top clients by paid revenue.
 *
 * Aggregation runs entirely inside Postgres via the `client_revenue_summary`
 * RPC (see migration 0016) — at scale this is O(log n) on the
 * (user_id, client_id) index path instead of O(n) over every invoice the
 * user has ever paid.
 */
export async function getClientRevenue(limit = 5): Promise<ClientRevenueRow[]> {
  const supabase = await getServerSupabase();
  const rows = await rpcClientRevenueSummary(supabase, { p_limit: limit });
  return rows.map((row) => ({
    clientId: row.client_id,
    totalPaid: Math.round(Number(row.total_paid ?? 0) * 100) / 100,
    invoiceCount: Number(row.invoice_count ?? 0),
  }));
}
