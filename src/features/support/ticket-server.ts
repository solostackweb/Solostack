import "server-only";

/**
 * First-party support — server-side read layer.
 *
 * Customer reads go through the RLS-scoped server client (a user only ever
 * sees their own tickets + non-internal messages). Guest + admin reads use
 * the service-role client with an explicit token / admin guard.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import type {
  SupportPlan,
  SupportTicket,
  SupportMessage,
  SupportThreadView,
  SupportCannedResponse,
} from "./ticket-types";

/** Resolve a user's current plan (defaults to "free"). */
export async function resolveUserPlan(userId: string): Promise<SupportPlan> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { plan?: string | null; status?: string | null } | null;
  const plan = row?.plan;
  if (plan === "pro" || plan === "business") return plan;
  return "free";
}

/** All tickets belonging to the signed-in user (most recent first). */
export async function listMyTickets(): Promise<SupportTicket[]> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(100);
  return (data as SupportTicket[] | null) ?? [];
}

/** One of the user's tickets + its customer-visible messages (RLS-scoped). */
export async function getMyTicketThread(
  ticketId: string,
): Promise<SupportThreadView | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket) return null;

  const { data: messages } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true });

  return {
    ticket: ticket as SupportTicket,
    messages: (messages as SupportMessage[] | null) ?? [],
  };
}

/** Guest thread by public token (service-role; token IS the authorisation). */
export async function getGuestTicketThread(
  token: string,
): Promise<SupportThreadView | null> {
  if (!token || token.length < 16) return null;
  const admin = getAdminSupabase();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!ticket) return null;

  const { data: messages } = await admin
    .from("support_messages")
    .select("*")
    .eq("ticket_id", (ticket as SupportTicket).id)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true });

  return {
    ticket: ticket as SupportTicket,
    messages: (messages as SupportMessage[] | null) ?? [],
  };
}

/**
 * Admin thread by id — includes internal notes. Caller MUST have already
 * passed `requireAdmin()` (RSC page or admin server action).
 */
export async function adminGetTicketThread(
  ticketId: string,
): Promise<SupportThreadView | null> {
  const admin = getAdminSupabase();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return null;

  const { data: messages } = await admin
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return {
    ticket: ticket as SupportTicket,
    messages: (messages as SupportMessage[] | null) ?? [],
  };
}

/** Admin canned-response list (service-role). */
export async function listCannedResponses(): Promise<SupportCannedResponse[]> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("support_canned_responses")
    .select("*")
    .order("title", { ascending: true });
  return (data as SupportCannedResponse[] | null) ?? [];
}
