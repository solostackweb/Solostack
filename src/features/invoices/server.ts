import "server-only";

/**
 * Invoice persistence layer.
 *
 * Reads + writes are RLS-scoped via `getServerSupabase()`. Mutations live
 * in `./actions.ts` which delegate to this module for the heavy lifting
 * around the GST engine + invoice numbering.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type {
  InvoiceItemRow,
  InvoiceRow,
  InvoiceStatusRow,
  InvoiceTaxMode,
  InvoiceClassificationRow,
} from "@/lib/supabase/types";
import { formatInvoiceNumber } from "./engine";

export interface InvoiceItemRecord {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  amount: number;
  position: number;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientId: string | null;
  projectId: string | null;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatusRow;
  taxMode: InvoiceTaxMode;
  classification: InvoiceClassificationRow;
  currency: string;
  subtotal: number;
  discount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxTotal: number;
  totalAmount: number;
  sellerStateCode: string | null;
  clientStateCode: string | null;
  footerNote: string | null;
  hsnSac: string | null;
  notes: string | null;
  terms: string | null;
  paymentLink: string | null;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentAmount: number | null;
  paymentRecordedAt: string | null;
  publicToken: string | null;
  viewedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Compute effective status at read-time.
 * An invoice that is `sent` or `viewed` and whose due_date is in the past
 * is considered `overdue` — no cron required.
 */
function computeEffectiveStatus(row: InvoiceRow): InvoiceStatusRow {
  if (
    (row.status === "sent" || row.status === "viewed") &&
    row.due_date &&
    new Date(row.due_date) < new Date()
  ) {
    return "overdue";
  }
  return row.status;
}

function mapInvoiceRow(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    clientId: row.client_id,
    projectId: row.project_id,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: computeEffectiveStatus(row),
    taxMode: row.tax_mode,
    classification: row.classification,
    currency: row.currency,
    subtotal: row.subtotal,
    discount: row.discount_amount ?? 0,
    cgstAmount: row.cgst_amount,
    sgstAmount: row.sgst_amount,
    igstAmount: row.igst_amount,
    taxTotal: row.gst_amount,
    totalAmount: row.total_amount,
    sellerStateCode: row.seller_state_code,
    clientStateCode: row.client_state_code,
    footerNote: row.footer_note,
    hsnSac: row.hsn_sac ?? null,
    notes: row.notes,
    terms: row.terms,
    paymentLink: row.payment_link,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentAmount: row.payment_amount,
    paymentRecordedAt: row.payment_recorded_at,
    publicToken: row.public_token,
    viewedAt: row.viewed_at,
    sentAt: row.sent_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItemRow(row: InvoiceItemRow): InvoiceItemRecord {
  return {
    id: row.id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    gstRate: row.gst_rate,
    amount: row.amount,
    position: row.position,
  };
}

export interface ListInvoicesOptions {
  status?: InvoiceStatusRow | "all";
  clientId?: string;
  projectId?: string;
  search?: string;
  limit?: number;
}

export async function listInvoices(
  opts: ListInvoicesOptions = {},
): Promise<InvoiceRecord[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.search?.trim()) {
    const term = opts.search.trim().replace(/[%,]/g, "");
    q = q.ilike("invoice_number", `%${term}%`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as InvoiceRow[]).map(mapInvoiceRow);
}

export async function getInvoice(id: string): Promise<{
  invoice: InvoiceRecord;
  items: InvoiceItemRecord[];
} | null> {
  const supabase = await getServerSupabase();
  const [{ data: inv }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", id)
      .order("position", { ascending: true }),
  ]);
  if (!inv) return null;
  return {
    invoice: mapInvoiceRow(inv as unknown as InvoiceRow),
    items: ((items as unknown as InvoiceItemRow[]) ?? []).map(mapItemRow),
  };
}

/**
 * Compute the next invoice number from `user_profiles.invoice_prefix` +
 * `invoice_next_number`. Returns the formatted string AND the integer to
 * persist back so the action can atomically bump the counter.
 */
export async function nextInvoiceNumber(userId: string): Promise<{
  formatted: string;
  next: number;
  prefix: string;
}> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("user_profiles")
    .select("invoice_prefix, invoice_next_number, invoice_number_padding")
    .eq("id", userId)
    .maybeSingle();
  const prefix =
    (data as { invoice_prefix?: string | null } | null)?.invoice_prefix ??
    "INV-";
  const next =
    (data as { invoice_next_number?: number } | null)?.invoice_next_number ??
    1;
  const padding =
    (data as { invoice_number_padding?: number } | null)
      ?.invoice_number_padding ?? 4;
  return { formatted: formatInvoiceNumber(prefix, next, padding), next, prefix };
}

/**
 * Aggregate dashboard stats for invoices.
 *
 * IMPORTANT — accounting separation. Invoices are a DUE mechanism, not a
 * realisation of revenue. The returned shape deliberately splits:
 *
 *   - `totalInvoiced`     : sum of all invoices ever issued (sent/viewed/
 *                           paid/overdue/partially_paid). The headline
 *                           "we billed this much" number.
 *   - `collectedAllTime`  : sum of paid invoices. The only number that
 *                           represents actual money in the bank.
 *   - `paidThisMonth`     : collected revenue this calendar month.
 *   - `outstanding`       : sum of unpaid issued invoices (sent / viewed
 *                           / overdue / partially_paid). Equivalent to
 *                           accrued income in single-entry accounting
 *                           terms.
 *   - `overdueAmount`     : subset of `outstanding` that is past due.
 *
 * The previous single-number `paidThisMonth` shape is preserved for
 * back-compat with the existing dashboard widgets.
 */
export async function getInvoiceAggregates(): Promise<{
  paidThisMonth: number;
  collectedAllTime: number;
  totalInvoiced: number;
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
  draftCount: number;
  recent: InvoiceRecord[];
}> {
  const supabase = await getServerSupabase();
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString();

  // Pull just the small set of fields needed to compute every aggregate
  // in-app. For a single freelancer's lifetime invoice volume this is
  // tiny and far cheaper than running six separate `count`/`sum` queries.
  const [{ data: allRows }, { count: draftCount }, { data: recent }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("total_amount, paid_at, status, due_date"),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft"),
      supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  type AggRow = {
    total_amount?: number;
    paid_at?: string | null;
    status?: string;
    due_date?: string | null;
  };
  const rows = (allRows as AggRow[] | null) ?? [];

  let paidThisMonth = 0;
  let collectedAllTime = 0;
  let totalInvoiced = 0;
  let outstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;

  for (const r of rows) {
    const amt = Number(r.total_amount) || 0;
    const storedStatus = r.status ?? "draft";
    const status =
      (storedStatus === "sent" || storedStatus === "viewed") &&
      r.due_date &&
      new Date(r.due_date) < new Date()
        ? "overdue"
        : storedStatus;
    // Drafts have NOT been issued — they're not part of total_invoiced.
    if (status === "draft") continue;
    totalInvoiced += amt;

    if (status === "paid") {
      collectedAllTime += amt;
      if (r.paid_at && r.paid_at >= monthStart) {
        paidThisMonth += amt;
      }
      continue;
    }

    // Everything else issued-but-not-paid is outstanding.
    outstanding += amt;
    if (status === "overdue") {
      overdueAmount += amt;
      overdueCount += 1;
    }
  }

  return {
    paidThisMonth,
    collectedAllTime,
    totalInvoiced,
    outstanding,
    overdueAmount,
    overdueCount,
    draftCount: draftCount ?? 0,
    recent: ((recent as unknown as InvoiceRow[]) ?? []).map(mapInvoiceRow),
  };
}
