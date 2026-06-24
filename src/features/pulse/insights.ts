import "server-only";

/**
 * Pulse insights — deeper client/revenue analytics + time profitability.
 *
 * Revenue figures are bucketed by `paid_at` within the range. "New vs
 * returning" uses each client's first-ever paid invoice (full history) to
 * decide whether they were won inside the range. Profitability reads the
 * billable `time_entries` produced by the Time feature.
 */

import { getServerSupabase } from "@/lib/supabase/server";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ClientShare {
  clientId: string | null;
  name: string;
  paid: number;
  pct: number;
}

export interface ProjectRevenue {
  projectId: string | null;
  name: string;
  paid: number;
}

export interface ProfitabilitySummary {
  trackedSeconds: number;
  billableSeconds: number;
  nonBillableSeconds: number;
  billableAmount: number;
  invoicedSeconds: number;
  invoicedAmount: number;
  unbilledSeconds: number;
  unbilledAmount: number;
  /** Realized rate on invoiced billable time (₹/hr). */
  effectiveRate: number;
  hasTimeData: boolean;
}

export interface PulseInsights {
  concentration: {
    totalPaid: number;
    top1Pct: number | null;
    top3Pct: number | null;
    byClient: ClientShare[];
  };
  clients: {
    newCount: number;
    returningCount: number;
  };
  byProject: ProjectRevenue[];
  profitability: ProfitabilitySummary;
}

export async function getPulseInsights(opts: {
  from: string;
  to: string;
}): Promise<PulseInsights> {
  const supabase = await getServerSupabase();
  const { from, to } = opts;
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T23:59:59.999Z`).getTime();

  const [{ data: paidData }, { data: timeData }] = await Promise.all([
    supabase
      .from("invoices")
      .select("client_id, project_id, total_amount, inr_equivalent, paid_at")
      .eq("status", "paid")
      .not("paid_at", "is", null),
    supabase
      .from("time_entries")
      .select("duration_seconds, billable, amount, invoice_id, started_at")
      .not("ended_at", "is", null)
      .gte("started_at", from)
      .lte("started_at", `${to}T23:59:59.999Z`),
  ]);

  type PaidRow = {
    client_id: string | null;
    project_id: string | null;
    total_amount: number | null;
    inr_equivalent?: number | null;
    paid_at: string | null;
  };
  const paidRows = (paidData as PaidRow[] | null) ?? [];

  // First-ever paid date per client (full history) for new vs returning.
  const firstPaid = new Map<string, number>();
  for (const r of paidRows) {
    if (!r.client_id || !r.paid_at) continue;
    const t = new Date(r.paid_at).getTime();
    const cur = firstPaid.get(r.client_id);
    if (cur === undefined || t < cur) firstPaid.set(r.client_id, t);
  }

  // Range-scoped revenue by client + project.
  const byClientMap = new Map<string | null, number>();
  const byProjectMap = new Map<string | null, number>();
  let totalPaid = 0;
  const clientsInRange = new Set<string>();

  for (const r of paidRows) {
    if (!r.paid_at) continue;
    const t = new Date(r.paid_at).getTime();
    if (t < fromMs || t > toMs) continue;
    const amt = Number(r.inr_equivalent ?? r.total_amount) || 0;
    totalPaid += amt;
    byClientMap.set(r.client_id, (byClientMap.get(r.client_id) ?? 0) + amt);
    byProjectMap.set(r.project_id, (byProjectMap.get(r.project_id) ?? 0) + amt);
    if (r.client_id) clientsInRange.add(r.client_id);
  }

  // New vs returning among clients who paid in range.
  let newCount = 0;
  let returningCount = 0;
  for (const cid of clientsInRange) {
    const first = firstPaid.get(cid);
    if (first !== undefined && first >= fromMs) newCount += 1;
    else returningCount += 1;
  }

  // Resolve names.
  const clientIds = Array.from(byClientMap.keys()).filter(
    (id): id is string => Boolean(id),
  );
  const projectIds = Array.from(byProjectMap.keys()).filter(
    (id): id is string => Boolean(id),
  );
  const [clientNames, projectNames] = await Promise.all([
    resolveClientNames(clientIds),
    resolveProjectNames(projectIds),
  ]);

  const byClient: ClientShare[] = Array.from(byClientMap.entries())
    .map(([clientId, paid]) => ({
      clientId,
      name: clientId ? (clientNames.get(clientId) ?? "Unknown client") : "No client",
      paid: round2(paid),
      pct: totalPaid > 0 ? round2((paid / totalPaid) * 100) : 0,
    }))
    .sort((a, b) => b.paid - a.paid);

  const byProject: ProjectRevenue[] = Array.from(byProjectMap.entries())
    .map(([projectId, paid]) => ({
      projectId,
      name: projectId ? (projectNames.get(projectId) ?? "Unknown project") : "No project",
      paid: round2(paid),
    }))
    .sort((a, b) => b.paid - a.paid);

  const top1Pct = byClient.length > 0 ? byClient[0]!.pct : null;
  const top3Pct =
    byClient.length > 0
      ? round2(byClient.slice(0, 3).reduce((s, c) => s + c.pct, 0))
      : null;

  // Profitability from time entries.
  type TimeRow = {
    duration_seconds: number;
    billable: boolean;
    amount: number | null;
    invoice_id: string | null;
  };
  const timeRows = (timeData as TimeRow[] | null) ?? [];
  let trackedSeconds = 0;
  let billableSeconds = 0;
  let nonBillableSeconds = 0;
  let billableAmount = 0;
  let invoicedSeconds = 0;
  let invoicedAmount = 0;
  let unbilledSeconds = 0;
  let unbilledAmount = 0;
  for (const r of timeRows) {
    const secs = r.duration_seconds || 0;
    trackedSeconds += secs;
    if (r.billable) {
      const amt = Number(r.amount) || 0;
      billableSeconds += secs;
      billableAmount += amt;
      if (r.invoice_id) {
        invoicedSeconds += secs;
        invoicedAmount += amt;
      } else {
        unbilledSeconds += secs;
        unbilledAmount += amt;
      }
    } else {
      nonBillableSeconds += secs;
    }
  }
  const effectiveRate =
    invoicedSeconds > 0
      ? round2(invoicedAmount / (invoicedSeconds / 3600))
      : billableSeconds > 0
        ? round2(billableAmount / (billableSeconds / 3600))
        : 0;

  return {
    concentration: { totalPaid: round2(totalPaid), top1Pct, top3Pct, byClient },
    clients: { newCount, returningCount },
    byProject,
    profitability: {
      trackedSeconds,
      billableSeconds,
      nonBillableSeconds,
      billableAmount: round2(billableAmount),
      invoicedSeconds,
      invoicedAmount: round2(invoicedAmount),
      unbilledSeconds,
      unbilledAmount: round2(unbilledAmount),
      effectiveRate,
      hasTimeData: timeRows.length > 0,
    },
  };
}

async function resolveClientNames(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  if (ids.length === 0) return m;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("clients")
    .select("id, business_name, full_name, company_name")
    .in("id", ids);
  for (const r of (data as Array<{
    id: string;
    business_name: string | null;
    full_name: string | null;
    company_name: string | null;
  }> | null) ?? []) {
    m.set(r.id, r.business_name ?? r.company_name ?? r.full_name ?? "Client");
  }
  return m;
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
