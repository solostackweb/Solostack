import "server-only";

/**
 * Pulse report builders — shared by the CSV + PDF export route.
 *
 * Zero-dependency CSV serializers for the financial summary, invoice ledger,
 * GST report, and client revenue; plus `buildFinancialReportPdfData`, the
 * branded view-model the `<FinancialReportPdf />` template renders.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature } from "@/features/subscription/features";
import { fetchStorageAsDataUrl } from "@/features/profile/storage";
import { resolveBrand, type ResolvedBrand } from "@/features/documents/pdf/brand";
import type { UserProfileRow, SubscriptionRow } from "@/lib/supabase/types";
import { getPulseAnalytics, type PulseAnalytics } from "./analytics";
import { getPulseInsights, type PulseInsights } from "./insights";

// --- CSV helpers ------------------------------------------------------------

function csvCell(v: string | number | boolean): string {
  const s = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
const BOM = "﻿";
const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

// --- Summary CSV ------------------------------------------------------------

export function buildSummaryCsv(
  analytics: PulseAnalytics,
  insights: PulseInsights,
): string {
  const a = analytics;
  const rows: Array<[string, string]> = [
    ["Range", `${a.range.from} to ${a.range.to}`],
    ["Revenue (paid)", fmt(a.revenue.paid)],
    ["Average monthly", fmt(a.revenue.averageMonthly)],
    ["MoM growth %", a.revenue.momGrowthPct === null ? "" : fmt(a.revenue.momGrowthPct)],
    ["Invoices issued", String(a.invoices.issuedCount)],
    ["Invoices paid", String(a.invoices.paidCount)],
    ["Issued value", fmt(a.invoices.issuedTotal)],
    ["Collection rate %", a.invoices.collectionRatePct === null ? "" : fmt(a.invoices.collectionRatePct)],
    ["Outstanding", fmt(a.receivables.outstandingTotal)],
    ["Overdue", fmt(a.receivables.overdueTotal)],
    ["Aging current", fmt(a.receivables.aging.current)],
    ["Aging 1-30", fmt(a.receivables.aging.d1_30)],
    ["Aging 31-60", fmt(a.receivables.aging.d31_60)],
    ["Aging 61-90", fmt(a.receivables.aging.d61_90)],
    ["Aging 90+", fmt(a.receivables.aging.d90plus)],
    ["Avg days to pay", a.cashFlow.avgDaysToPay === null ? "" : String(a.cashFlow.avgDaysToPay)],
    ["Median days to pay", a.cashFlow.medianDaysToPay === null ? "" : String(a.cashFlow.medianDaysToPay)],
    ["Funnel issued", String(a.funnel.issued)],
    ["Funnel viewed", String(a.funnel.viewed)],
    ["Funnel paid", String(a.funnel.paid)],
    ["Top client share %", insights.concentration.top1Pct === null ? "" : fmt(insights.concentration.top1Pct)],
    ["Top 3 share %", insights.concentration.top3Pct === null ? "" : fmt(insights.concentration.top3Pct)],
    ["New clients", String(insights.clients.newCount)],
    ["Returning clients", String(insights.clients.returningCount)],
    ["Tracked hours", fmt(insights.profitability.trackedSeconds / 3600)],
    ["Billable hours", fmt(insights.profitability.billableSeconds / 3600)],
    ["Invoiced (time) value", fmt(insights.profitability.invoicedAmount)],
    ["Unbilled (time) value", fmt(insights.profitability.unbilledAmount)],
    ["Effective rate /hr", fmt(insights.profitability.effectiveRate)],
  ];
  if (a.gst.inUse) {
    rows.push(
      ["GST taxable value", fmt(a.gst.totals.taxable)],
      ["GST CGST", fmt(a.gst.totals.cgst)],
      ["GST SGST", fmt(a.gst.totals.sgst)],
      ["GST IGST", fmt(a.gst.totals.igst)],
      ["GST total tax", fmt(a.gst.totals.tax)],
      ["Non-GST / exempt value", fmt(a.gst.exempt.taxable)],
    );
  }
  const lines = ["Metric,Value", ...rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)];
  return BOM + lines.join("\r\n");
}

// --- Invoice ledger ---------------------------------------------------------

export interface LedgerRow {
  issueDate: string;
  number: string;
  clientName: string;
  status: string;
  taxable: number;
  tax: number;
  total: number;
  paidAt: string;
  daysToPay: string;
}

export async function getInvoiceLedger(opts: {
  from: string;
  to: string;
}): Promise<LedgerRow[]> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("invoices")
    .select(
      "issue_date, invoice_number, client_id, status, subtotal, discount_amount, gst_amount, total_amount, paid_at",
    )
    .gte("issue_date", opts.from)
    .lte("issue_date", opts.to)
    .neq("status", "draft")
    .order("issue_date", { ascending: true })
    .limit(5000);

  type Row = {
    issue_date: string;
    invoice_number: string;
    client_id: string | null;
    status: string;
    subtotal: number | null;
    discount_amount: number | null;
    gst_amount: number | null;
    total_amount: number | null;
    paid_at: string | null;
  };
  const rows = (data as Row[] | null) ?? [];

  const ids = Array.from(
    new Set(rows.map((r) => r.client_id).filter((v): v is string => !!v)),
  );
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: cData } = await supabase
      .from("clients")
      .select("id, business_name, full_name, company_name")
      .in("id", ids);
    for (const c of (cData as Array<{
      id: string;
      business_name: string | null;
      full_name: string | null;
      company_name: string | null;
    }> | null) ?? []) {
      names.set(c.id, c.business_name ?? c.company_name ?? c.full_name ?? "Client");
    }
  }

  return rows.map((r) => {
    const taxable = (Number(r.subtotal) || 0) - (Number(r.discount_amount) || 0);
    let daysToPay = "";
    if (r.paid_at && r.issue_date) {
      const d = Math.round(
        (new Date(r.paid_at).getTime() -
          new Date(`${r.issue_date}T00:00:00Z`).getTime()) /
          86_400_000,
      );
      if (d >= 0) daysToPay = String(d);
    }
    return {
      issueDate: r.issue_date,
      number: r.invoice_number,
      clientName: r.client_id ? (names.get(r.client_id) ?? "Unknown client") : "—",
      status: r.status,
      taxable: Math.max(0, taxable),
      tax: Number(r.gst_amount) || 0,
      total: Number(r.total_amount) || 0,
      paidAt: r.paid_at ? r.paid_at.slice(0, 10) : "",
      daysToPay,
    };
  });
}

export function buildLedgerCsv(rows: LedgerRow[]): string {
  const header = [
    "Issue date",
    "Invoice #",
    "Client",
    "Status",
    "Taxable",
    "Tax",
    "Total",
    "Paid on",
    "Days to pay",
  ];
  const lines = [header.join(",")];
  let taxable = 0,
    tax = 0,
    total = 0;
  for (const r of rows) {
    taxable += r.taxable;
    tax += r.tax;
    total += r.total;
    lines.push(
      [
        csvCell(r.issueDate),
        csvCell(r.number),
        csvCell(r.clientName),
        csvCell(r.status),
        csvCell(fmt(r.taxable)),
        csvCell(fmt(r.tax)),
        csvCell(fmt(r.total)),
        csvCell(r.paidAt),
        csvCell(r.daysToPay),
      ].join(","),
    );
  }
  lines.push(
    ["Total", "", "", "", fmt(taxable), fmt(tax), fmt(total), "", ""].join(","),
  );
  return BOM + lines.join("\r\n");
}

// --- GST CSV ----------------------------------------------------------------

export function buildGstCsv(gst: PulseAnalytics["gst"]): string {
  const lines: string[] = [];
  lines.push("GST summary");
  lines.push("Metric,Value");
  lines.push(`Taxable value,${fmt(gst.totals.taxable)}`);
  lines.push(`CGST,${fmt(gst.totals.cgst)}`);
  lines.push(`SGST,${fmt(gst.totals.sgst)}`);
  lines.push(`IGST,${fmt(gst.totals.igst)}`);
  lines.push(`Total tax,${fmt(gst.totals.tax)}`);
  lines.push(`Invoices,${gst.totals.invoiceCount}`);
  lines.push(`Non-GST / exempt value,${fmt(gst.exempt.taxable)}`);
  lines.push("");
  lines.push("By rate");
  lines.push("Rate %,Taxable,CGST,SGST,IGST,Tax,Invoices");
  for (const r of gst.byRate) {
    lines.push(
      [r.rate, fmt(r.taxable), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.tax), r.count].join(","),
    );
  }
  lines.push("");
  lines.push("By client and place of supply");
  lines.push("Client,State,Type,Taxable,Tax,Invoices");
  for (const c of gst.byClient) {
    lines.push(
      [
        csvCell(c.clientName),
        csvCell(c.stateCode ?? ""),
        c.b2b ? "B2B" : "B2C",
        fmt(c.taxable),
        fmt(c.tax),
        c.count,
      ].join(","),
    );
  }
  return BOM + lines.join("\r\n");
}

// --- Clients CSV ------------------------------------------------------------

export function buildClientsCsv(byClient: PulseInsights["concentration"]["byClient"]): string {
  const header = ["Client", "Paid revenue", "Share %"];
  const lines = [header.join(",")];
  for (const c of byClient) {
    lines.push([csvCell(c.name), fmt(c.paid), fmt(c.pct)].join(","));
  }
  return BOM + lines.join("\r\n");
}

// --- PDF view-model ---------------------------------------------------------

export interface FinancialReportPdfData {
  brand: ResolvedBrand;
  rangeLabel: string;
  generatedAt: string;
  analytics: PulseAnalytics;
  insights: PulseInsights;
}

export async function buildFinancialReportPdfData(args: {
  from: string;
  to: string;
  rangeLabel: string;
}): Promise<FinancialReportPdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profileData }, { data: subData }, analytics, insights] =
    await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
      getPulseAnalytics({ from: args.from, to: args.to }),
      getPulseInsights({ from: args.from, to: args.to }),
    ]);

  const seller = (profileData as unknown as UserProfileRow | null) ?? null;
  const sub = (subData as unknown as SubscriptionRow | null) ?? null;
  const canBrand = hasFeature(
    sub
      ? {
          userId: sub.user_id,
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trial_ends_at,
          currentPeriodEnd: sub.current_period_end,
          razorpaySubscriptionId: sub.razorpay_subscription_id,
        }
      : null,
    "invoices.custom_branding",
  );
  const logoUrl = canBrand
    ? (await fetchStorageAsDataUrl("branding-assets", seller?.logo_url, supabase)) ??
      (await fetchStorageAsDataUrl("branding-assets", seller?.brand_icon_url, supabase))
    : null;

  return {
    brand: resolveBrand(seller, logoUrl),
    rangeLabel: args.rangeLabel,
    generatedAt: new Date().toISOString(),
    analytics,
    insights,
  };
}
