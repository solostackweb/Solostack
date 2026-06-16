import "server-only";

/**
 * Timesheet report builders — shared by the CSV + PDF export route.
 *
 * `getTimeReportRows` resolves project/client names once and returns a flat,
 * presentation-ready row set. `buildTimesheetCsv` is a zero-dependency CSV
 * serializer. `buildTimesheetPdfData` assembles the branded view-model the
 * `<TimesheetPdf />` template renders.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { hasFeature } from "@/features/subscription/features";
import { fetchStorageAsDataUrl } from "@/features/profile/storage";
import { resolveBrand, type ResolvedBrand } from "@/features/documents/pdf/brand";
import type {
  TimeEntryRow,
  UserProfileRow,
  SubscriptionRow,
} from "@/lib/supabase/types";
import { mapTimeEntryRow } from "./server";
import type { TimeAnalytics } from "./analytics";

export interface TimeReportFilters {
  from?: string;
  to?: string;
  projectId?: string | null; // null = "no project"
  status?: "all" | "billable" | "non_billable" | "unbilled" | "invoiced";
  q?: string;
}

export interface TimeReportRow {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  projectName: string;
  clientName: string;
  durationSeconds: number;
  hours: number; // decimal, 2dp
  billable: boolean;
  hourlyRate: number;
  amount: number;
  invoiced: boolean;
}

const MAX_ROWS = 5000;

export async function getTimeReportRows(
  filters: TimeReportFilters = {},
): Promise<TimeReportRow[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("time_entries")
    .select("*")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true });

  if (filters.q && filters.q.trim()) q = q.ilike("description", `%${filters.q.trim()}%`);
  if (filters.projectId === null) q = q.is("project_id", null);
  else if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.status === "billable") q = q.eq("billable", true);
  else if (filters.status === "non_billable") q = q.eq("billable", false);
  else if (filters.status === "unbilled") q = q.eq("billable", true).is("invoice_id", null);
  else if (filters.status === "invoiced") q = q.not("invoice_id", "is", null);
  if (filters.from) q = q.gte("started_at", filters.from);
  if (filters.to) q = q.lte("started_at", filters.to);
  q = q.limit(MAX_ROWS);

  const { data } = await q;
  const entries = ((data as unknown as TimeEntryRow[]) ?? []).map(mapTimeEntryRow);

  const projectIds = Array.from(
    new Set(entries.map((e) => e.projectId).filter((v): v is string => !!v)),
  );
  const clientIds = Array.from(
    new Set(entries.map((e) => e.clientId).filter((v): v is string => !!v)),
  );

  const [projectNames, clientNames] = await Promise.all([
    resolveProjectNames(projectIds),
    resolveClientNames(clientIds),
  ]);

  return entries.map((e) => ({
    id: e.id,
    date: e.startedAt.slice(0, 10),
    description: e.description ?? "",
    projectName: e.projectId ? (projectNames.get(e.projectId) ?? "Unknown project") : "—",
    clientName: e.clientId ? (clientNames.get(e.clientId) ?? "Unknown client") : "—",
    durationSeconds: e.durationSeconds,
    hours: Math.round((e.durationSeconds / 3600) * 100) / 100,
    billable: e.billable,
    hourlyRate: e.hourlyRate,
    amount: e.billable ? Number(e.amount) || 0 : 0,
    invoiced: !!e.invoiceId,
  }));
}

async function resolveProjectNames(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const supabase = await getServerSupabase();
  const { data } = await supabase.from("projects").select("id, name").in("id", ids);
  for (const r of (data as Array<{ id: string; name: string }> | null) ?? []) {
    m.set(r.id, r.name);
  }
  return m;
}

async function resolveClientNames(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("id, business_name, full_name")
    .in("id", ids);
  for (const r of (data as Array<{ id: string; business_name: string | null; full_name: string | null }> | null) ?? []) {
    m.set(r.id, r.business_name ?? r.full_name ?? "Client");
  }
  return m;
}

// --- CSV --------------------------------------------------------------------

function csvCell(v: string | number | boolean): string {
  const s = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildTimesheetCsv(rows: TimeReportRow[]): string {
  const header = [
    "Date",
    "Description",
    "Project",
    "Client",
    "Hours",
    "Billable",
    "Rate",
    "Amount",
    "Invoiced",
  ];
  const lines = [header.join(",")];
  let totalHours = 0;
  let totalAmount = 0;
  for (const r of rows) {
    totalHours += r.hours;
    totalAmount += r.amount;
    lines.push(
      [
        csvCell(r.date),
        csvCell(r.description),
        csvCell(r.projectName),
        csvCell(r.clientName),
        csvCell(r.hours.toFixed(2)),
        csvCell(r.billable),
        csvCell(r.hourlyRate ? r.hourlyRate.toFixed(2) : ""),
        csvCell(r.amount ? r.amount.toFixed(2) : ""),
        csvCell(r.invoiced),
      ].join(","),
    );
  }
  lines.push(
    ["Total", "", "", "", totalHours.toFixed(2), "", "", totalAmount.toFixed(2), ""].join(","),
  );
  // BOM so Excel detects UTF-8.
  return "﻿" + lines.join("\r\n");
}

// --- PDF view-model ---------------------------------------------------------

export interface TimesheetPdfData {
  brand: ResolvedBrand;
  rangeLabel: string;
  generatedAt: string;
  rows: TimeReportRow[];
  totalSeconds: number;
  totalHours: number;
  billableAmount: number;
  utilization: number;
}

export async function buildTimesheetPdfData(args: {
  filters: TimeReportFilters;
  analytics: TimeAnalytics;
  rangeLabel: string;
}): Promise<TimesheetPdfData | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const seller = (profileData as unknown as UserProfileRow | null) ?? null;

  const { data: subData } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
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

  const brand = resolveBrand(seller, logoUrl);
  const rows = await getTimeReportRows(args.filters);

  return {
    brand,
    rangeLabel: args.rangeLabel,
    generatedAt: new Date().toISOString(),
    rows,
    totalSeconds: args.analytics.totalSeconds,
    totalHours: Math.round((args.analytics.totalSeconds / 3600) * 100) / 100,
    billableAmount: args.analytics.billableAmount,
    utilization: args.analytics.utilization,
  };
}
