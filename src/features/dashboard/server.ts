import "server-only";

/**
 * Dashboard aggregation layer.
 *
 * `getDashboardSnapshot()` is the single function the dashboard page calls.
 * It runs all the per-domain aggregates in parallel and packages them into
 * ONE typed view-model so RSC can render the whole shell without
 * waterfalling. Everything the widgets display — names, initials, labels —
 * is pre-computed here so each widget is a pure render function.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { getInvoiceAggregates, type InvoiceRecord } from "@/features/invoices/server";
import { getProjectAggregates } from "@/features/projects/server";
import {
  getClientAggregates,
  mapClientRow,
  type ClientRecord,
} from "@/features/clients/server";
import { getContractAggregates } from "@/features/contracts/server";
import {
  getOverdueTotal,
  getRevenueSeries,
  getClientRevenue,
  type ClientRevenueRow,
} from "@/features/pulse/server";
import { listActivity, type ActivityRecord } from "@/features/activity/server";
import { getTimeAggregates } from "@/features/time/server";
import { getUnreadNotificationCount } from "@/features/notifications/server";
import type { ClientRow } from "@/lib/supabase/types";

export interface InvoiceFeedItem {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: InvoiceRecord["status"];
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  clientId: string | null;
  clientName: string;
  clientInitials: string;
  /** Negative = overdue by N days, positive = due in N days, 0 = due today. */
  dueInDays: number;
}

export interface ClientFeedItem {
  id: string;
  name: string;
  email: string | null;
  initials: string;
  lifetimeValue: number;
}

export interface TopClientRow extends ClientRevenueRow {
  name: string;
  initials: string;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name) return "·";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || "·";
}

function displayName(client: ClientRecord | undefined): string {
  if (!client) return "Unknown client";
  return client.businessName ?? client.fullName ?? "Unknown client";
}

function daysBetween(fromIso: string, now = Date.now()): number {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((t - now) / 86_400_000);
}

/**
 * Hydrate an arbitrary list of invoices with their client display info.
 * Clients are batch-fetched so there's no N+1.
 */
async function hydrateInvoiceFeed(
  invoices: InvoiceRecord[],
): Promise<InvoiceFeedItem[]> {
  if (invoices.length === 0) return [];
  const supabase = await getServerSupabase();
  const clientIds = Array.from(
    new Set(invoices.map((i) => i.clientId).filter((id): id is string => !!id)),
  );
  const clientMap = new Map<string, ClientRecord>();
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    for (const row of (data as unknown as ClientRow[]) ?? []) {
      const mapped = mapClientRow(row);
      clientMap.set(mapped.id, mapped);
    }
  }

  return invoices.map((inv) => {
    const client = inv.clientId ? clientMap.get(inv.clientId) : undefined;
    const name = displayName(client);
    return {
      id: inv.id,
      number: inv.invoiceNumber,
      amount: inv.totalAmount,
      currency: inv.currency,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      clientId: inv.clientId,
      clientName: name,
      clientInitials: initialsFromName(name),
      dueInDays: daysBetween(inv.dueDate),
    };
  });
}

export async function getDashboardSnapshot() {
  const monthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString();

  const [
    invoices,
    projects,
    clients,
    contracts,
    overdue,
    revenueSeries,
    topClientsRaw,
    activity,
    time,
    unreadNotifications,
  ] = await Promise.all([
    getInvoiceAggregates(),
    getProjectAggregates(),
    getClientAggregates(),
    getContractAggregates(),
    getOverdueTotal(),
    getRevenueSeries(6),
    getClientRevenue(5),
    listActivity({ limit: 10 }),
    getTimeAggregates({ from: monthStart }),
    getUnreadNotificationCount(),
  ]);

  // Run the two display-hydration steps in parallel — they are independent,
  // each fetches a small set of client rows by `id`.
  const topClientIds = topClientsRaw
    .map((r) => r.clientId)
    .filter((id): id is string => !!id);

  const [recentInvoices, topClientMap] = await Promise.all([
    hydrateInvoiceFeed(invoices.recent),
    (async (): Promise<Map<string, ClientRecord>> => {
      const map = new Map<string, ClientRecord>();
      if (topClientIds.length === 0) return map;
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("clients")
        .select("*")
        .in("id", topClientIds);
      for (const row of (data as unknown as ClientRow[]) ?? []) {
        const mapped = mapClientRow(row);
        map.set(mapped.id, mapped);
      }
      return map;
    })(),
  ]);

  const topClients: TopClientRow[] = topClientsRaw.map((r) => {
    const client = r.clientId ? topClientMap.get(r.clientId) : undefined;
    const name = displayName(client);
    return {
      ...r,
      name,
      initials: initialsFromName(name),
    };
  });

  const recentClients: ClientFeedItem[] = clients.recent.map((c) => {
    const name = c.businessName ?? c.fullName;
    return {
      id: c.id,
      name,
      email: c.email,
      initials: initialsFromName(name),
      lifetimeValue:
        topClients.find((t) => t.clientId === c.id)?.totalPaid ?? 0,
    };
  });

  return {
    invoices,
    projects,
    clients,
    contracts,
    pulse: { overdue, revenueSeries, topClients },
    activity,
    time,
    unreadNotifications,
    recentInvoices,
    recentClients,
  };
}

export type DashboardSnapshot = Awaited<ReturnType<typeof getDashboardSnapshot>>;
export type { ActivityRecord };

// ─── Focused snapshot functions for Suspense streaming ────────────────────

/**
 * KPI strip + revenue series — pure DB aggregates, no hydration step.
 * These are fast parallel queries that populate the above-the-fold tiles.
 */
export async function getKpiSnapshot() {
  // Start of current week (Monday) for time-tracking summary tile.
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysToMonday);
  weekStart.setHours(0, 0, 0, 0);

  const [invoices, projects, overdue, revenueSeries, time] = await Promise.all([
    getInvoiceAggregates(),
    getProjectAggregates(),
    getOverdueTotal(),
    getRevenueSeries(6),
    getTimeAggregates({ from: weekStart.toISOString() }),
  ]);
  return {
    collectedAllTime: invoices.collectedAllTime,
    outstanding: invoices.outstanding,
    overdueAmount: overdue.total,
    activeProjects: projects.active,
    weeklyBillableSeconds: time.billableSeconds + time.nonBillableSeconds,
    weeklyBillableAmount: time.billableAmount,
    revenueSeries,
  };
}

/**
 * Recent invoices (with client-name hydration) + activity timeline.
 * Runs the hydration waterfall in isolation so the KPI tiles don't wait for it.
 */
export async function getRecentFeedSnapshot() {
  const [invoices, rawActivity] = await Promise.all([
    getInvoiceAggregates(),
    listActivity({ limit: 10 }),
  ]);
  const recentInvoices = await hydrateInvoiceFeed(invoices.recent);
  return { recentInvoices, activity: rawActivity };
}

/**
 * Recent clients — needs a client-revenue join for lifetime values.
 * Kept separate so the invoice feed above can stream in first.
 */
export async function getRecentClientsSnapshot() {
  const [clients, topClientsRaw] = await Promise.all([
    getClientAggregates(),
    getClientRevenue(5),
  ]);

  const topClientIds = topClientsRaw
    .map((r) => r.clientId)
    .filter((id): id is string => !!id);

  const topClientMap = new Map<string, ClientRecord>();
  if (topClientIds.length > 0) {
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from("clients")
      .select("*")
      .in("id", topClientIds);
    for (const row of (data as unknown as ClientRow[]) ?? []) {
      const mapped = mapClientRow(row);
      topClientMap.set(mapped.id, mapped);
    }
  }

  const topClients: TopClientRow[] = topClientsRaw.map((r) => {
    const client = r.clientId ? topClientMap.get(r.clientId) : undefined;
    const name = displayName(client);
    return { ...r, name, initials: initialsFromName(name) };
  });

  const recentClients: ClientFeedItem[] = clients.recent.map((c) => {
    const name = c.businessName ?? c.fullName;
    return {
      id: c.id,
      name,
      email: c.email,
      initials: initialsFromName(name),
      lifetimeValue: topClients.find((t) => t.clientId === c.id)?.totalPaid ?? 0,
    };
  });

  return { recentClients };
}

/**
 * Reminders feed — overdue invoices + contracts expiring within 14 days.
 * Kept as a separate snapshot so it can stream in alongside `getRecentClientsSnapshot`
 * without blocking the KPI tiles or invoice feed above.
 */
export async function getRemindersSnapshot(): Promise<{
  reminders: import("@/components/dashboard/upcoming-reminders").ReminderItem[];
}> {
  const supabase = await getServerSupabase();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const in14 = new Date(now.getTime() + 14 * 86_400_000).toISOString();

  // Overdue: either explicitly overdue, or live invoices whose due date has
  // passed. This mirrors the invoice read model's effective-status logic.
  const { data: overdueRows } = await supabase
    .from("invoices")
    .select("id, invoice_number, due_date, total_amount, currency")
    .in("status", ["sent", "viewed", "overdue"])
    .lte("due_date", todayIso)
    .order("due_date", { ascending: true })
    .limit(4);

  // Expiring: sent/viewed contracts whose expires_at falls within the next 14 days
  const { data: expiringRows } = await supabase
    .from("contracts")
    .select("id, title, expires_at")
    .in("status", ["sent", "viewed"])
    .not("expires_at", "is", null)
    .lte("expires_at", in14)
    .gte("expires_at", now.toISOString())
    .order("expires_at", { ascending: true })
    .limit(3);

  type OverdueRow = {
    id: string;
    invoice_number: string;
    due_date: string;
    total_amount: number;
    currency: string;
  };
  type ExpiringRow = { id: string; title: string; expires_at: string };

  const reminders: import("@/components/dashboard/upcoming-reminders").ReminderItem[] = [];

  for (const row of (overdueRows ?? []) as OverdueRow[]) {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(row.due_date).getTime()) / 86_400_000,
    );
    const amt = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: row.currency || "INR",
      maximumFractionDigits: 0,
    }).format(Number(row.total_amount));
    reminders.push({
      id: `inv-${row.id}`,
      kind: "invoice",
      title: row.invoice_number,
      description: amt,
      dueLabel: daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`,
      tone: daysOverdue > 7 ? "destructive" : "warning",
      href: `/dashboard/invoices/${row.id}`,
    });
  }

  for (const row of (expiringRows ?? []) as ExpiringRow[]) {
    const daysLeft = Math.ceil(
      (new Date(row.expires_at).getTime() - now.getTime()) / 86_400_000,
    );
    reminders.push({
      id: `con-${row.id}`,
      kind: "contract",
      title: row.title,
      description: "Awaiting signature",
      dueLabel: daysLeft <= 1 ? "Expires today" : `Expires in ${daysLeft}d`,
      tone: daysLeft <= 3 ? "warning" : "info",
      href: `/dashboard/contracts/${row.id}`,
    });
  }

  return { reminders };
}

/**
 * Sidebar counters — small + cheap. Called from the dashboard layout's
 * navigation so the sidebar always reflects current state.
 */
export async function getSidebarCounters() {
  const [invoices, projects, contracts, unread] = await Promise.all([
    getInvoiceAggregates(),
    getProjectAggregates(),
    getContractAggregates(),
    getUnreadNotificationCount(),
  ]);
  return {
    invoicesDraft: invoices.draftCount,
    invoicesOverdue: invoices.overdueCount,
    projectsActive: projects.active,
    contractsAwaitingSignature: contracts.awaitingSignature,
    notificationsUnread: unread,
   };
}
