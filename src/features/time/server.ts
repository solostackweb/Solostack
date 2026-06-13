import "server-only";

/**
 * Time-tracking persistence + aggregation.
 *
 * `startTimer()` creates an open-ended row (`ended_at IS NULL`); `stopTimer`
 * closes it and computes the billable amount. Manual entries skip the timer
 * altogether. The DB has a partial index on `(user_id) WHERE ended_at IS NULL`
 * so "the running timer" lookup is essentially free.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import type { TimeEntryRow } from "@/lib/supabase/types";

export interface TimeEntryRecord {
  id: string;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  billable: boolean;
  hourlyRate: number;
  amount: number;
  tags: string[];
  invoiceId: string | null;
  invoicedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function mapTimeEntryRow(row: TimeEntryRow): TimeEntryRecord {
  return {
    id: row.id,
    description: row.description,
    projectId: row.project_id,
    clientId: row.client_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    billable: row.billable,
    hourlyRate: row.hourly_rate,
    amount: row.amount,
    tags: row.tags ?? [],
    invoiceId: row.invoice_id ?? null,
    invoicedAt: row.invoiced_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Compute the billable amount for a time entry.
 *   amount = (durationSeconds / 3600) * hourlyRate
 * Rounded to two decimals.
 */
export function computeAmount(durationSeconds: number, hourlyRate: number): number {
  const hours = durationSeconds / 3600;
  return Math.round(hours * hourlyRate * 100) / 100;
}

export interface ListTimeEntriesOptions {
  projectId?: string;
  clientId?: string;
  from?: string; // ISO timestamp
  to?: string;
  billable?: boolean;
  limit?: number;
}

export async function listTimeEntries(
  opts: ListTimeEntriesOptions = {},
): Promise<TimeEntryRecord[]> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("time_entries")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  if (opts.from) q = q.gte("started_at", opts.from);
  if (opts.to) q = q.lte("started_at", opts.to);
  if (typeof opts.billable === "boolean") q = q.eq("billable", opts.billable);
  const { data, error } = await q;
  if (error || !data) return [];
  return (data as unknown as TimeEntryRow[]).map(mapTimeEntryRow);
}

/**
 * The currently-running timer for the authenticated user, if any.
 * (`ended_at IS NULL` — there should be at most one.)
 */
export async function getRunningTimer(): Promise<TimeEntryRecord | null> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", user.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return mapTimeEntryRow(data as unknown as TimeEntryRow);
}

/**
 * Aggregations for the dashboard + Pulse:
 *   - total billable seconds in a window
 *   - total billable amount
 *   - per-project breakdown (top 5 by hours)
 */
export async function getTimeAggregates(opts: {
  from?: string;
  to?: string;
} = {}): Promise<{
  billableSeconds: number;
  nonBillableSeconds: number;
  billableAmount: number;
  byProject: Array<{ projectId: string | null; seconds: number; amount: number }>;
}> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("time_entries")
    .select("project_id, duration_seconds, amount, billable")
    .not("ended_at", "is", null);
  if (opts.from) q = q.gte("started_at", opts.from);
  if (opts.to) q = q.lte("started_at", opts.to);
  const { data } = await q;
  type Row = Pick<TimeEntryRow, "project_id" | "duration_seconds" | "amount" | "billable">;
  const rows = (data as unknown as Row[]) ?? [];

  let billableSeconds = 0;
  let nonBillableSeconds = 0;
  let billableAmount = 0;
  const byProjectMap = new Map<
    string | null,
    { seconds: number; amount: number }
  >();

  for (const r of rows) {
    if (r.billable) {
      billableSeconds += r.duration_seconds;
      billableAmount += Number(r.amount) || 0;
    } else {
      nonBillableSeconds += r.duration_seconds;
    }
    const cur = byProjectMap.get(r.project_id) ?? { seconds: 0, amount: 0 };
    cur.seconds += r.duration_seconds;
    cur.amount += Number(r.amount) || 0;
    byProjectMap.set(r.project_id, cur);
  }

  const byProject = Array.from(byProjectMap.entries())
    .map(([projectId, v]) => ({ projectId, ...v }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 5);

  return {
    billableSeconds,
    nonBillableSeconds,
    billableAmount: Math.round(billableAmount * 100) / 100,
    byProject,
  };
}

// --- Billing integration ----------------------------------------------------

export interface UnbilledTimeGroup {
  projectId: string | null;
  projectName: string | null;
  entryIds: string[];
  seconds: number;
  amount: number;
  /** Weighted-average hourly rate across the group (amount / hours). */
  effectiveRate: number;
  earliest: string;
  latest: string;
}

export interface UnbilledTimeSummary {
  entries: TimeEntryRecord[];
  groups: UnbilledTimeGroup[];
  totalSeconds: number;
  totalAmount: number;
}

/**
 * Billable, completed, not-yet-invoiced time — optionally scoped to one
 * client. Powers the "Unbilled time" panel on invoice creation and the
 * Time page summary. Grouped per project so one project becomes one
 * invoice line item.
 */
export async function getUnbilledTime(opts: {
  clientId?: string;
} = {}): Promise<UnbilledTimeSummary> {
  const supabase = await getServerSupabase();
  let q = supabase
    .from("time_entries")
    .select("*")
    .eq("billable", true)
    .is("invoice_id", null)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: true })
    .limit(500);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  const { data } = await q;
  const entries = ((data as unknown as TimeEntryRow[]) ?? []).map(mapTimeEntryRow);

  // Resolve project names in one query.
  const projectIds = Array.from(
    new Set(entries.map((e) => e.projectId).filter((id): id is string => !!id)),
  );
  const names = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds);
    for (const p of (projects as Array<{ id: string; name: string }> | null) ?? []) {
      names.set(p.id, p.name);
    }
  }

  const groupMap = new Map<string | null, UnbilledTimeGroup>();
  let totalSeconds = 0;
  let totalAmount = 0;
  for (const e of entries) {
    totalSeconds += e.durationSeconds;
    totalAmount += e.amount;
    const key = e.projectId;
    const g =
      groupMap.get(key) ??
      ({
        projectId: key,
        projectName: key ? names.get(key) ?? null : null,
        entryIds: [],
        seconds: 0,
        amount: 0,
        effectiveRate: 0,
        earliest: e.startedAt,
        latest: e.startedAt,
      } satisfies UnbilledTimeGroup);
    g.entryIds.push(e.id);
    g.seconds += e.durationSeconds;
    g.amount += e.amount;
    if (e.startedAt < g.earliest) g.earliest = e.startedAt;
    if (e.startedAt > g.latest) g.latest = e.startedAt;
    groupMap.set(key, g);
  }
  const groups = Array.from(groupMap.values())
    .map((g) => ({
      ...g,
      amount: Math.round(g.amount * 100) / 100,
      effectiveRate:
        g.seconds > 0 ? Math.round((g.amount / (g.seconds / 3600)) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    entries,
    groups,
    totalSeconds,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Atomically claim a set of billable entries for an invoice. The filters
 * repeat the "unbilled + billable + finished + owned by user" conditions so
 * a stale client can never double-bill an entry that was invoiced elsewhere
 * in the meantime. Returns the number of entries actually claimed.
 */
export async function markTimeEntriesInvoiced(
  userId: string,
  entryIds: string[],
  invoiceId: string,
): Promise<number> {
  if (entryIds.length === 0) return 0;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("time_entries")
    .update({
      invoice_id: invoiceId,
      invoiced_at: new Date().toISOString(),
    } as never)
    .eq("user_id", userId)
    .eq("billable", true)
    .is("invoice_id", null)
    .not("ended_at", "is", null)
    .in("id", entryIds)
    .select("id");
  return (data as Array<{ id: string }> | null)?.length ?? 0;
}
