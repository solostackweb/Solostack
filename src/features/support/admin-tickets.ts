import "server-only";

/**
 * Founder-console reads over the first-party `support_tickets` /
 * `support_messages` tables. Service-role only (never exposed to
 * authenticated callers). Callers must already be behind `requireAdmin()`.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { SupportTicket, TicketStatus, SupportPlan } from "./ticket-types";

export type AdminTicketTab =
  | "all"
  | "needs_reply"
  | "waiting"
  | "resolved"
  | "failures";

export interface AdminTicketFilter {
  tab?: AdminTicketTab;
  plan?: SupportPlan | "all";
  search?: string;
  limit?: number;
}

const NEEDS_REPLY: TicketStatus[] = ["new", "open", "waiting_on_us"];

/** List tickets for the admin inbox, newest-active first. */
export async function adminListTickets(
  filter: AdminTicketFilter = {},
): Promise<SupportTicket[]> {
  const admin = getAdminSupabase();
  const limit = Math.min(filter.limit ?? 60, 200);

  let q = admin
    .from("support_tickets")
    .select("*")
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (filter.tab === "needs_reply") q = q.in("status", NEEDS_REPLY);
  else if (filter.tab === "waiting") q = q.eq("status", "waiting_on_customer");
  else if (filter.tab === "resolved") q = q.in("status", ["resolved", "closed"]);

  if (filter.plan && filter.plan !== "all") q = q.eq("plan_at_creation", filter.plan);

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim().replace(/[%,]/g, "");
    q = q.or(`subject.ilike.%${s}%,email.ilike.%${s}%`);
  }

  const { data } = await q;
  return (data as SupportTicket[] | null) ?? [];
}

export interface SupportMetrics {
  needsReply: number;
  waitingOnCustomer: number;
  resolved7d: number;
  slaBreached: number;
}

/** Headline counts for the inbox metric bar. */
export async function getSupportMetrics(): Promise<SupportMetrics> {
  const admin = getAdminSupabase();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const nowIso = new Date().toISOString();

  const [needsReply, waitingOnCustomer, resolved7d, slaBreached] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", NEEDS_REPLY),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting_on_customer"),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["resolved", "closed"])
      .gte("resolved_at", sevenDaysAgo),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", NEEDS_REPLY)
      .is("first_response_at", null)
      .not("sla_due_at", "is", null)
      .lt("sla_due_at", nowIso),
  ]);

  return {
    needsReply: needsReply.count ?? 0,
    waitingOnCustomer: waitingOnCustomer.count ?? 0,
    resolved7d: resolved7d.count ?? 0,
    slaBreached: slaBreached.count ?? 0,
  };
}

export interface TicketCustomerContext {
  plan: SupportPlan;
  totalTickets: number;
  openTickets: number;
  userId: string | null;
}

/** Lightweight customer panel context for the conversation view. */
export async function getTicketCustomerContext(
  ticket: SupportTicket,
): Promise<TicketCustomerContext> {
  const admin = getAdminSupabase();
  const base = { plan: ticket.plan_at_creation, userId: ticket.user_id };

  if (!ticket.user_id) {
    // Guest — count tickets sharing this email.
    const { count: total } = await admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("email", ticket.email);
    return { ...base, totalTickets: total ?? 0, openTickets: 0 };
  }

  const [total, open] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ticket.user_id),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ticket.user_id)
      .not("status", "in", "(resolved,closed)"),
  ]);

  return {
    ...base,
    totalTickets: total.count ?? 0,
    openTickets: open.count ?? 0,
  };
}
