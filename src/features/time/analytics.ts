import "server-only";

/**
 * Time analytics — read-only aggregations powering the Reports tab and the
 * timesheet PDF. All figures are derived from completed entries only
 * (`ended_at` not null). Grouping by day uses the entry's UTC date, which
 * keeps day buckets stable across requests.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type { TimeEntryRow } from "@/lib/supabase/types";

export interface TimeAnalyticsFilters {
  from?: string;
  to?: string;
  projectId?: string | null; // null = "no project"
  clientId?: string | null;
}

export interface AnalyticsBucket {
  key: string | null;
  seconds: number;
  amount: number;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD
  seconds: number;
  billableSeconds: number;
  amount: number;
}

export interface TimeAnalytics {
  totalSeconds: number;
  billableSeconds: number;
  nonBillableSeconds: number;
  billableAmount: number;
  /** billableSeconds / totalSeconds, 0..1. */
  utilization: number;
  entryCount: number;
  byProject: AnalyticsBucket[];
  byClient: AnalyticsBucket[];
  byDay: DailyPoint[];
}

type Row = Pick<
  TimeEntryRow,
  "project_id" | "client_id" | "duration_seconds" | "amount" | "billable" | "started_at"
>;

export async function getTimeAnalytics(
  filters: TimeAnalyticsFilters = {},
): Promise<TimeAnalytics> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("time_entries")
    .select("project_id, client_id, duration_seconds, amount, billable, started_at")
    .not("ended_at", "is", null);

  if (filters.from) q = q.gte("started_at", filters.from);
  if (filters.to) q = q.lte("started_at", filters.to);
  if (filters.projectId === null) q = q.is("project_id", null);
  else if (filters.projectId) q = q.eq("project_id", filters.projectId);
  if (filters.clientId === null) q = q.is("client_id", null);
  else if (filters.clientId) q = q.eq("client_id", filters.clientId);

  const { data } = await q;
  const rows = (data as unknown as Row[]) ?? [];

  let totalSeconds = 0;
  let billableSeconds = 0;
  let billableAmount = 0;
  const projectMap = new Map<string | null, { seconds: number; amount: number }>();
  const clientMap = new Map<string | null, { seconds: number; amount: number }>();
  const dayMap = new Map<string, { seconds: number; billableSeconds: number; amount: number }>();

  for (const r of rows) {
    const secs = r.duration_seconds || 0;
    const amt = r.billable ? Number(r.amount) || 0 : 0;
    totalSeconds += secs;
    if (r.billable) {
      billableSeconds += secs;
      billableAmount += amt;
    }

    const pCur = projectMap.get(r.project_id) ?? { seconds: 0, amount: 0 };
    pCur.seconds += secs;
    pCur.amount += amt;
    projectMap.set(r.project_id, pCur);

    const cCur = clientMap.get(r.client_id) ?? { seconds: 0, amount: 0 };
    cCur.seconds += secs;
    cCur.amount += amt;
    clientMap.set(r.client_id, cCur);

    const dayKey = (r.started_at ?? "").slice(0, 10);
    if (dayKey) {
      const dCur = dayMap.get(dayKey) ?? { seconds: 0, billableSeconds: 0, amount: 0 };
      dCur.seconds += secs;
      if (r.billable) {
        dCur.billableSeconds += secs;
        dCur.amount += amt;
      }
      dayMap.set(dayKey, dCur);
    }
  }

  const toBuckets = (m: Map<string | null, { seconds: number; amount: number }>): AnalyticsBucket[] =>
    Array.from(m.entries())
      .map(([key, v]) => ({ key, seconds: v.seconds, amount: Math.round(v.amount * 100) / 100 }))
      .sort((a, b) => b.seconds - a.seconds);

  const byDay: DailyPoint[] = Array.from(dayMap.entries())
    .map(([date, v]) => ({
      date,
      seconds: v.seconds,
      billableSeconds: v.billableSeconds,
      amount: Math.round(v.amount * 100) / 100,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    totalSeconds,
    billableSeconds,
    nonBillableSeconds: totalSeconds - billableSeconds,
    billableAmount: Math.round(billableAmount * 100) / 100,
    utilization: totalSeconds > 0 ? billableSeconds / totalSeconds : 0,
    entryCount: rows.length,
    byProject: toBuckets(projectMap),
    byClient: toBuckets(clientMap),
    byDay,
  };
}
