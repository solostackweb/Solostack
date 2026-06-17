import "server-only";

/**
 * Pulse analytics engine.
 *
 * One range-scoped invoice pull (issued within the range) powers revenue,
 * collection, funnel and GST signals; a second snapshot pull of *open*
 * invoices powers receivables + AR aging (which are a "now" view, not a
 * range view). Everything is RLS-scoped to the current user.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type { InvoiceRow } from "@/lib/supabase/types";

export interface PulseRevenuePoint {
  /** YYYY-MM (UTC). */
  month: string;
  paid: number;
}

export interface AgingBuckets {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
}

export interface PulseAnalytics {
  range: { from: string; to: string; months: number };
  revenue: {
    paid: number;
    series: PulseRevenuePoint[];
    momGrowthPct: number | null;
    averageMonthly: number;
  };
  invoices: {
    issuedCount: number;
    issuedTotal: number;
    paidCount: number;
    paidTotal: number;
    collectionRatePct: number | null;
  };
  receivables: {
    outstandingTotal: number;
    outstandingCount: number;
    overdueTotal: number;
    overdueCount: number;
    aging: AgingBuckets;
  };
  cashFlow: {
    avgDaysToPay: number | null;
    medianDaysToPay: number | null;
  };
  funnel: {
    issued: number;
    viewed: number;
    paid: number;
    viewedRatePct: number | null;
    paidRatePct: number | null;
  };
  gst: GstReport;
}

export interface GstRateRow {
  /** Effective GST rate (%) for the bucket. */
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  count: number;
}

export interface GstClientRow {
  clientId: string | null;
  clientName: string;
  stateCode: string | null;
  b2b: boolean;
  taxable: number;
  tax: number;
  count: number;
}

export interface GstReport {
  /** Whether to surface the GST section at all. */
  inUse: boolean;
  registered: boolean;
  hasGstInvoices: boolean;
  totals: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    invoiceCount: number;
  };
  /** Non-GST (exempt / unregistered) supplies in range. */
  exempt: { taxable: number; count: number };
  intra: { taxable: number; tax: number; count: number };
  inter: { taxable: number; tax: number; count: number };
  byRate: GstRateRow[];
  byClient: GstClientRow[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

function monthsBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  return (
    (t.getUTCFullYear() - f.getUTCFullYear()) * 12 +
    (t.getUTCMonth() - f.getUTCMonth()) +
    1
  );
}

type RangeRow = Pick<
  InvoiceRow,
  | "issue_date"
  | "paid_at"
  | "viewed_at"
  | "total_amount"
  | "status"
  | "tax_mode"
  | "payment_amount"
  | "subtotal"
  | "discount_amount"
  | "cgst_amount"
  | "sgst_amount"
  | "igst_amount"
  | "gst_amount"
  | "classification"
  | "client_id"
  | "client_state_code"
>;

type OpenRow = Pick<
  InvoiceRow,
  "total_amount" | "due_date" | "status" | "payment_amount"
>;

const OPEN_STATUSES = ["sent", "viewed", "overdue", "partially_paid"];

export async function getPulseAnalytics(opts: {
  from: string;
  to: string;
}): Promise<PulseAnalytics> {
  const supabase = await getServerSupabase();
  const { from, to } = opts;
  const months = Math.max(1, monthsBetween(from, to));

  const [{ data: rangeData }, { data: openData }, { data: profileData }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "issue_date, paid_at, viewed_at, total_amount, status, tax_mode, payment_amount, subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, gst_amount, classification, client_id, client_state_code",
        )
        .gte("issue_date", from)
        .lte("issue_date", to),
      supabase
        .from("invoices")
        .select("total_amount, due_date, status, payment_amount")
        .in("status", OPEN_STATUSES),
      supabase
        .from("user_profiles")
        .select("gst_registered, gstin, gst_number")
        .maybeSingle(),
    ]);

  const rangeRows = (rangeData as unknown as RangeRow[]) ?? [];
  const openRows = (openData as unknown as OpenRow[]) ?? [];
  const profile =
    (profileData as {
      gst_registered: boolean | null;
      gstin: string | null;
      gst_number: string | null;
    } | null) ?? null;

  // --- Monthly paid series (bucket by paid_at) ---
  const buckets = new Map<string, PulseRevenuePoint>();
  const fromDate = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < months; i++) {
    const d = new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + i, 1),
    );
    buckets.set(monthKey(d), { month: monthKey(d), paid: 0 });
  }

  let paidTotal = 0;
  let paidCount = 0;
  let issuedTotal = 0;
  let issuedCount = 0;
  let viewedCount = 0;
  let hasGstInvoices = false;
  const daysToPay: number[] = [];

  // GST accumulators
  let gTaxable = 0, gCgst = 0, gSgst = 0, gIgst = 0, gCount = 0;
  let exemptTaxable = 0, exemptCount = 0;
  const intra = { taxable: 0, tax: 0, count: 0 };
  const inter = { taxable: 0, tax: 0, count: 0 };
  const byRateMap = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number; count: number }>();
  const byClientMap = new Map<string | null, { stateCode: string | null; b2b: boolean; taxable: number; tax: number; count: number }>();

  for (const r of rangeRows) {
    if (r.tax_mode && r.tax_mode !== "non_gst") hasGstInvoices = true;
    const total = Number(r.total_amount) || 0;

    // Cancelled invoices are voided documents — excluded from issued/funnel.
    if (r.status === "cancelled") continue;
    if (r.status !== "draft") {
      issuedCount += 1;
      issuedTotal += total;
    }
    if (r.viewed_at || r.status === "viewed" || r.status === "paid") {
      viewedCount += 1;
    }
    if (r.status === "paid" && r.paid_at) {
      paidCount += 1;
      paidTotal += total;
      const b = buckets.get(monthKey(new Date(r.paid_at)));
      if (b) b.paid += total;
      if (r.issue_date) {
        const d =
          (new Date(r.paid_at).getTime() -
            new Date(`${r.issue_date}T00:00:00Z`).getTime()) /
          86_400_000;
        if (d >= 0 && d < 3650) daysToPay.push(d);
      }
    }

    // --- GST aggregation (issued invoices only) ---
    if (r.status === "draft") continue;
    const taxable = Math.max(
      0,
      (Number(r.subtotal) || 0) - (Number(r.discount_amount) || 0),
    );
    if (!r.tax_mode || r.tax_mode === "non_gst") {
      exemptTaxable += taxable;
      exemptCount += 1;
      continue;
    }
    const cgst = Number(r.cgst_amount) || 0;
    const sgst = Number(r.sgst_amount) || 0;
    const igst = Number(r.igst_amount) || 0;
    const tax = cgst + sgst + igst || Number(r.gst_amount) || 0;
    gTaxable += taxable;
    gCgst += cgst;
    gSgst += sgst;
    gIgst += igst;
    gCount += 1;

    const rate = taxable > 0 ? Math.round((tax / taxable) * 100) : 0;
    const rb = byRateMap.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
    rb.taxable += taxable;
    rb.cgst += cgst;
    rb.sgst += sgst;
    rb.igst += igst;
    rb.count += 1;
    byRateMap.set(rate, rb);

    if (r.tax_mode === "igst") {
      inter.taxable += taxable;
      inter.tax += tax;
      inter.count += 1;
    } else {
      intra.taxable += taxable;
      intra.tax += tax;
      intra.count += 1;
    }

    const cb = byClientMap.get(r.client_id) ?? {
      stateCode: r.client_state_code ?? null,
      b2b: r.classification === "b2b",
      taxable: 0,
      tax: 0,
      count: 0,
    };
    cb.taxable += taxable;
    cb.tax += tax;
    cb.count += 1;
    byClientMap.set(r.client_id, cb);
  }

  const series = Array.from(buckets.values()).map((b) => ({
    month: b.month,
    paid: round2(b.paid),
  }));

  let momGrowthPct: number | null = null;
  if (series.length >= 2) {
    const prev = series[series.length - 2]!.paid;
    const curr = series[series.length - 1]!.paid;
    if (prev > 0) momGrowthPct = round2(((curr - prev) / prev) * 100);
    else if (curr > 0) momGrowthPct = 100;
  }

  // --- Receivables snapshot + aging ---
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const aging: AgingBuckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
  };
  let outstandingTotal = 0;
  let overdueTotal = 0;
  let overdueCount = 0;

  for (const r of openRows) {
    const balance =
      (Number(r.total_amount) || 0) - (Number(r.payment_amount) || 0);
    if (balance <= 0) continue;
    outstandingTotal += balance;
    const due = r.due_date ? new Date(`${r.due_date}T00:00:00Z`) : null;
    const daysPast = due
      ? Math.floor((today.getTime() - due.getTime()) / 86_400_000)
      : 0;
    if (daysPast > 0) {
      overdueTotal += balance;
      overdueCount += 1;
    }
    if (daysPast <= 0) aging.current += balance;
    else if (daysPast <= 30) aging.d1_30 += balance;
    else if (daysPast <= 60) aging.d31_60 += balance;
    else if (daysPast <= 90) aging.d61_90 += balance;
    else aging.d90plus += balance;
  }

  // --- Cash flow ---
  let avgDaysToPay: number | null = null;
  let medianDaysToPay: number | null = null;
  if (daysToPay.length > 0) {
    avgDaysToPay = Math.round(
      daysToPay.reduce((s, d) => s + d, 0) / daysToPay.length,
    );
    const sorted = [...daysToPay].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDaysToPay = Math.round(
      sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!,
    );
  }

  const registered = Boolean(
    profile?.gst_registered || profile?.gstin || profile?.gst_number,
  );

  // Resolve client names for the GST by-client table.
  const clientIds = Array.from(byClientMap.keys()).filter(
    (id): id is string => Boolean(id),
  );
  const clientNames = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: cData } = await supabase
      .from("clients")
      .select("id, business_name, full_name, company_name")
      .in("id", clientIds);
    for (const c of (cData as Array<{
      id: string;
      business_name: string | null;
      full_name: string | null;
      company_name: string | null;
    }> | null) ?? []) {
      clientNames.set(c.id, c.business_name ?? c.company_name ?? c.full_name ?? "Client");
    }
  }

  const byRate: GstRateRow[] = Array.from(byRateMap.entries())
    .map(([rate, v]) => ({
      rate,
      taxable: round2(v.taxable),
      cgst: round2(v.cgst),
      sgst: round2(v.sgst),
      igst: round2(v.igst),
      tax: round2(v.cgst + v.sgst + v.igst),
      count: v.count,
    }))
    .sort((a, b) => b.rate - a.rate);

  const byClient: GstClientRow[] = Array.from(byClientMap.entries())
    .map(([clientId, v]) => ({
      clientId,
      clientName: clientId ? (clientNames.get(clientId) ?? "Unknown client") : "No client",
      stateCode: v.stateCode,
      b2b: v.b2b,
      taxable: round2(v.taxable),
      tax: round2(v.tax),
      count: v.count,
    }))
    .sort((a, b) => b.taxable - a.taxable);

  const gstReport: GstReport = {
    inUse: registered || gCount > 0,
    registered,
    hasGstInvoices,
    totals: {
      taxable: round2(gTaxable),
      cgst: round2(gCgst),
      sgst: round2(gSgst),
      igst: round2(gIgst),
      tax: round2(gCgst + gSgst + gIgst),
      invoiceCount: gCount,
    },
    exempt: { taxable: round2(exemptTaxable), count: exemptCount },
    intra: { taxable: round2(intra.taxable), tax: round2(intra.tax), count: intra.count },
    inter: { taxable: round2(inter.taxable), tax: round2(inter.tax), count: inter.count },
    byRate,
    byClient,
  };

  return {
    range: { from, to, months },
    revenue: {
      paid: round2(paidTotal),
      series,
      momGrowthPct,
      averageMonthly: round2(paidTotal / months),
    },
    invoices: {
      issuedCount,
      issuedTotal: round2(issuedTotal),
      paidCount,
      paidTotal: round2(paidTotal),
      collectionRatePct: issuedTotal > 0 ? round2((paidTotal / issuedTotal) * 100) : null,
    },
    receivables: {
      outstandingTotal: round2(outstandingTotal),
      outstandingCount: openRows.length,
      overdueTotal: round2(overdueTotal),
      overdueCount,
      aging: {
        current: round2(aging.current),
        d1_30: round2(aging.d1_30),
        d31_60: round2(aging.d31_60),
        d61_90: round2(aging.d61_90),
        d90plus: round2(aging.d90plus),
      },
    },
    cashFlow: { avgDaysToPay, medianDaysToPay },
    funnel: {
      issued: issuedCount,
      viewed: viewedCount,
      paid: paidCount,
      viewedRatePct: issuedCount > 0 ? round2((viewedCount / issuedCount) * 100) : null,
      paidRatePct: issuedCount > 0 ? round2((paidCount / issuedCount) * 100) : null,
    },
    gst: gstReport,
  };
}
