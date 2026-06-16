import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  getTimeReportRows,
  buildTimesheetCsv,
  buildTimesheetPdfData,
  type TimeReportFilters,
} from "@/features/time/report";
import { getTimeAnalytics } from "@/features/time/analytics";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { TimesheetPdf } from "@/features/documents/pdf/timesheet-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = NonNullable<TimeReportFilters["status"]>;
const STATUSES: Status[] = ["all", "billable", "non_billable", "unbilled", "invoiced"];

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Timesheet export. Honors the same filters as the Time dashboard
 * (from/to/project/status/q) and streams either a CSV or a branded PDF.
 *   GET /api/time/export?format=csv|pdf&from=&to=&project=&status=&q=
 */
export async function GET(req: Request) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const q = url.searchParams.get("q") || undefined;
  const projectParam = url.searchParams.get("project") || "all";
  const statusParam = url.searchParams.get("status") || "all";
  const status: Status = (STATUSES as string[]).includes(statusParam)
    ? (statusParam as Status)
    : "all";
  const projectId =
    projectParam === "all" ? undefined : projectParam === "none" ? null : projectParam;

  // Make `to` inclusive of the whole day when only a date was supplied.
  const toInclusive = to && to.length === 10 ? `${to}T23:59:59.999Z` : to;

  const filters: TimeReportFilters = { from, to: toInclusive, projectId, status, q };

  const rangeLabel =
    from && to ? `${fmtDay(from)} – ${fmtDay(to)}` : from ? `Since ${fmtDay(from)}` : "All time";

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const rows = await getTimeReportRows(filters);
    const csv = buildTimesheetCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="timesheet-${stamp}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }

  const analytics = await getTimeAnalytics({ from, to: toInclusive, projectId });
  const data = await buildTimesheetPdfData({ filters, analytics, rangeLabel });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buffer = await renderPdfToBuffer(TimesheetPdf({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="timesheet-${stamp}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
