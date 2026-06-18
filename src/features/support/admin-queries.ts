import "server-only";

/**
 * Founder-console support reads over the first-party `support_tickets` table.
 * Service-role only. (Replaces the old Crisp/Zoho `support_threads` reads.)
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import type { SupportTicket } from "./ticket-types";

const ACTIVE = ["new", "open", "waiting_on_us", "waiting_on_customer"];

/** Cheap counts for the support-pulse card on the admin home page. */
export interface SupportPulse {
  open_chats_24h: number;
  open_tickets: number;
  resolved_7d: number;
  total_open: number;
}

export async function getSupportPulse(): Promise<SupportPulse> {
  const admin = getAdminSupabase();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [new24h, waiting, resolved7d, totalOpen] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE)
      .gte("created_at", since24h),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting_on_customer"),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["resolved", "closed"])
      .gte("resolved_at", since7d),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE),
  ]);

  return {
    open_chats_24h: new24h.count ?? 0,
    open_tickets: waiting.count ?? 0,
    resolved_7d: resolved7d.count ?? 0,
    total_open: totalOpen.count ?? 0,
  };
}

/** Latest tickets for a given user (user-detail page widget). */
export async function listSupportThreadsForUser(
  userId: string,
  limit = 8,
): Promise<SupportTicket[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("support_tickets")
    .select("*")
    .eq("user_id", userId)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  return (data as SupportTicket[] | null) ?? [];
}

/** Churn-signal counts for a user — drives red badges on the user detail page. */
export interface ChurnSignals {
  open_threads: number;
  threads_30d: number;
  has_at_risk_tag: boolean;
}

export async function getUserChurnSignals(userId: string): Promise<ChurnSignals> {
  const admin = getAdminSupabase();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [openCnt, recentCnt, atRisk] = await Promise.all([
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ACTIVE),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since30d),
    admin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .contains("tags", ["at-risk-churn"]),
  ]);

  return {
    open_threads: openCnt.count ?? 0,
    threads_30d: recentCnt.count ?? 0,
    has_at_risk_tag: (atRisk.count ?? 0) > 0,
  };
}
