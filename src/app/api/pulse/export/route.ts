import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { canUseFeature } from "@/features/subscription/server";
import { getPulseAnalytics } from "@/features/pulse/analytics";
import { getPulseInsights } from "@/features/pulse/insights";
import {
  buildSummaryCsv,
  buildLedgerCsv,
  buildGstCsv,
  buildClientsCsv,
  getInvoiceLedger,
  buildFinancialReportPdfData,
} from "@/features/pulse/report";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { FinancialReportPdf } from "@/features/documents/pdf/financial-report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_MONTHS: Record<string, number> = { "3m": 3, "6m": 6, "12m": 12 };

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Pulse export. Pro-gated. Streams CSV or a branded PDF financial report.
 *   GET /api/pulse/export?format=csv|pdf&report=summary|ledger|gst|clients&range=&from=&to=
 */
export async function GET(req: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canUseFeature("pulse.advanced_reports"))) {
    return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const report = url.searchParams.get("report") || "summary";
  const rangeKey = url.searchParams.get("range") || "6m";
  const fromQ = url.searchParams.get("from") || undefined;
  const toQ = url.searchParams.get("to") || undefined;

  const hasCustom = Boolean(fromQ && toQ);
  const months = RANGE_MONTHS[rangeKey] ?? 6;
  const now = new Date();
  const to = hasCustom ? toQ! : now.toISOString().slice(0, 10);
  const from = hasCustom
    ? fromQ!
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
        .toISOString()
        .slice(0, 10);

  const rangeLabel = `${fmtDay(from)} – ${fmtDay(to)}`;
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "pdf") {
    const data = await buildFinancialReportPdfData({ from, to, rangeLabel });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const buffer = await renderPdfToBuffer(FinancialReportPdf({ data }));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="financial-report-${stamp}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }

  // CSV
  let csv: string;
  let name: string;
  if (report === "ledger") {
    csv = buildLedgerCsv(await getInvoiceLedger({ from, to }));
    name = `invoice-ledger-${stamp}.csv`;
  } else if (report === "clients") {
    const insights = await getPulseInsights({ from, to });
    csv = buildClientsCsv(insights.concentration.byClient);
    name = `client-revenue-${stamp}.csv`;
  } else if (report === "gst") {
    const analytics = await getPulseAnalytics({ from, to });
    if (!analytics.gst.inUse) {
      return NextResponse.json(
        { error: "GST report not available — no GST registration or GST invoices." },
        { status: 400 },
      );
    }
    csv = buildGstCsv(analytics.gst);
    name = `gst-report-${stamp}.csv`;
  } else {
    const [analytics, insights] = await Promise.all([
      getPulseAnalytics({ from, to }),
      getPulseInsights({ from, to }),
    ]);
    csv = buildSummaryCsv(analytics, insights);
    name = `financial-summary-${stamp}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
