"use server";

/**
 * First-party support — server actions (mutations).
 *
 * Customer:
 *   createTicketAction         — new ticket (authenticated OR guest).
 *   addCustomerMessageAction   — append a reply to one's own ticket.
 *   addGuestMessageAction      — append a reply via public token.
 *
 * Admin (requireAdmin):
 *   adminReplyAction           — agent reply or internal note (+ emails customer).
 *   adminSetStatusAction / adminSetPriorityAction / adminSetCategoryAction
 *   adminAddTagAction / adminRemoveTagAction / adminAssignAction
 *   adminCreateCannedAction / adminUpdateCannedAction / adminDeleteCannedAction
 *
 * Emails are best-effort: a transport failure never fails the mutation.
 */

import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/admin/server";
import { sendEmail } from "@/features/email/service";
import { getEmailSender } from "@/features/email/senders";
import { getPublicAppUrl } from "@/features/documents/urls";
import { log } from "@/lib/logger";
import {
  renderSupportTicketReceivedEmail,
  renderSupportReplyEmail,
  renderSupportAdminAlertEmail,
} from "@/features/email/templates";
import {
  computeSlaDueAt,
  TIER_SUPPORT_POLICY,
  type SupportPlan,
  type SupportTicket,
  type TicketCategory,
  type TicketStatus,
  type TicketPriority,
  type CreateTicketResult,
} from "./ticket-types";
import { resolveUserPlan } from "./ticket-server";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CATEGORY_VALUES = [
  "billing",
  "bug",
  "how-to",
  "feature-request",
  "account",
  "onboarding",
] as const;

const createSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(5).max(8000),
  channel: z.enum(["in_app", "chat", "email", "contact_form"]).optional(),
  page: z.string().max(500).optional(),
  email: z.string().email().max(254).optional(),
  name: z.string().max(160).optional(),
});

const messageSchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
});

const guestMessageSchema = z.object({
  token: z.string().min(16).max(80),
  body: z.string().trim().min(1).max(8000),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Higher-severity categories jump the queue. */
function priorityForCategory(category: TicketCategory): TicketPriority {
  if (category === "billing" || category === "bug" || category === "account") {
    return "high";
  }
  return "normal";
}

function inAppThreadUrl(ticketId: string): string {
  return `${getPublicAppUrl()}/help/tickets/${ticketId}`;
}

function guestThreadUrl(token: string): string {
  return `${getPublicAppUrl()}/support/t/${token}`;
}

function adminTicketUrl(ticketId: string): string {
  return `${getPublicAppUrl()}/admin/support/${ticketId}`;
}

/** Reply-to address that carries the ticket token (parsed by inbound worker). */
function replyToAddress(token: string): string {
  const support = getEmailSender("support").email; // support@stackivo.me
  const [local, domain] = support.split("@");
  return `${local}+${token}@${domain}`;
}

function threadUrlFor(ticket: Pick<SupportTicket, "id" | "user_id" | "public_token">): string {
  return ticket.user_id ? inAppThreadUrl(ticket.id) : guestThreadUrl(ticket.public_token);
}

// ---------------------------------------------------------------------------
// Customer: create ticket
// ---------------------------------------------------------------------------

export async function createTicketAction(
  input: z.infer<typeof createSchema>,
): Promise<CreateTicketResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userId: string | null = null;
  let email = data.email ?? null;
  let name = data.name ?? null;
  let plan: SupportPlan = "free";

  if (user) {
    userId = user.id;
    email = user.email ?? email;
    plan = await resolveUserPlan(user.id);
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    name = name ?? (prof as { full_name?: string | null } | null)?.full_name ?? null;
  }

  if (!email) {
    return { ok: false, error: "Email is required for support requests." };
  }

  const nowIso = new Date().toISOString();
  const cookieStore = await cookies();
  const traceId = cookieStore.get("x-request-id")?.value ?? null;
  const channel = data.channel ?? (user ? "in_app" : "contact_form");

  const admin = getAdminSupabase();
  const { data: ticketRow, error: ticketErr } = await admin
    .from("support_tickets")
    .insert({
      user_id: userId,
      email,
      name,
      subject: data.subject,
      status: "new",
      priority: priorityForCategory(data.category),
      category: data.category,
      plan_at_creation: plan,
      channel,
      source_page: data.page ?? null,
      trace_id: traceId,
      sla_due_at: computeSlaDueAt(plan, nowIso),
      last_message_at: nowIso,
      last_customer_message_at: nowIso,
    } as never)
    .select("id, public_token")
    .single();

  if (ticketErr || !ticketRow) {
    log.error("support.create_ticket.failed", { error: ticketErr?.message });
    return { ok: false, error: "Couldn't create your ticket. Please try again." };
  }

  const ticket = ticketRow as { id: string; public_token: string };

  const { error: msgErr } = await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    author_type: "customer",
    author_user_id: userId,
    body: data.message,
    via: channel === "email" ? "email" : "in_app",
  } as never);
  if (msgErr) {
    log.error("support.create_ticket.message_failed", { error: msgErr.message });
  }

  const threadUrl = userId ? inAppThreadUrl(ticket.id) : guestThreadUrl(ticket.public_token);
  const slaLabel = TIER_SUPPORT_POLICY[plan].slaLabel;

  // Customer acknowledgement (best-effort).
  try {
    const ack = renderSupportTicketReceivedEmail({
      customerName: name,
      subject: data.subject,
      slaLabel,
      threadUrl,
      senderEmail: getEmailSender("support").email,
    });
    await sendEmail({
      type: "support",
      to: { email, name: name ?? undefined },
      replyTo: { email: replyToAddress(ticket.public_token), name: "Stackivo Support" },
      subject: ack.subject,
      html: ack.html,
      text: ack.text,
      tags: ["support_ack"],
      headers: { "X-Stackivo-Ticket": ticket.id },
    });
  } catch (err) {
    log.warn("support.create_ticket.ack_email_failed", {
      ticketId: ticket.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Founder alert (best-effort) → Workspace support mailbox.
  try {
    const alert = renderSupportAdminAlertEmail({
      subject: data.subject,
      category: data.category,
      plan,
      fromEmail: email,
      excerpt: data.message.slice(0, 280),
      adminUrl: adminTicketUrl(ticket.id),
    });
    await sendEmail({
      type: "support",
      to: { email: getEmailSender("support").email, name: "Stackivo Support" },
      replyTo: { email, name: name ?? undefined },
      subject: alert.subject,
      html: alert.html,
      text: alert.text,
      tags: ["support_admin_alert"],
    });
  } catch (err) {
    log.warn("support.create_ticket.alert_email_failed", {
      ticketId: ticket.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  revalidatePath("/help");
  revalidatePath("/admin/support");
  return { ok: true, ticketId: ticket.id, publicToken: ticket.public_token };
}

// ---------------------------------------------------------------------------
// Customer: append message (authenticated)
// ---------------------------------------------------------------------------

export async function addCustomerMessageAction(
  input: z.infer<typeof messageSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { ticketId, body } = parsed.data;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to continue." };

  // RLS guarantees the insert only succeeds on the user's own ticket.
  const { error } = await supabase.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "customer",
    author_user_id: user.id,
    body,
    via: "in_app",
  } as never);
  if (error) return { ok: false, error: "Couldn't send your message." };

  const nowIso = new Date().toISOString();
  const admin = getAdminSupabase();
  await admin
    .from("support_tickets")
    .update({
      status: "waiting_on_us",
      last_message_at: nowIso,
      last_customer_message_at: nowIso,
    } as never)
    .eq("id", ticketId)
    .eq("user_id", user.id);

  revalidatePath(`/help/tickets/${ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Guest: append message (by public token)
// ---------------------------------------------------------------------------

export async function addGuestMessageAction(
  input: z.infer<typeof guestMessageSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const parsed = guestMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { token, body } = parsed.data;

  const admin = getAdminSupabase();
  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id")
    .eq("public_token", token)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Ticket not found." };
  const ticketId = (ticket as { id: string }).id;

  const { error } = await admin.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "customer",
    body,
    via: "in_app",
  } as never);
  if (error) return { ok: false, error: "Couldn't send your message." };

  const nowIso = new Date().toISOString();
  await admin
    .from("support_tickets")
    .update({
      status: "waiting_on_us",
      last_message_at: nowIso,
      last_customer_message_at: nowIso,
    } as never)
    .eq("id", ticketId);

  revalidatePath(`/support/t/${token}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: reply / internal note
// ---------------------------------------------------------------------------

const adminReplySchema = z.object({
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
  internal: z.boolean().optional(),
});

export async function adminReplyAction(
  input: z.infer<typeof adminReplySchema>,
): Promise<{ ok: boolean; error?: string }> {
  const adminUser = await requireAdmin();
  const parsed = adminReplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { ticketId, body, internal } = parsed.data;
  const admin = getAdminSupabase();

  const { data: ticketRow } = await admin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticketRow) return { ok: false, error: "Ticket not found." };
  const ticket = ticketRow as SupportTicket;

  const { error } = await admin.from("support_messages").insert({
    ticket_id: ticketId,
    author_type: "agent",
    author_user_id: adminUser.id,
    body,
    via: "in_app",
    is_internal_note: internal ?? false,
  } as never);
  if (error) return { ok: false, error: "Couldn't post the reply." };

  const nowIso = new Date().toISOString();

  if (!internal) {
    const update: Record<string, unknown> = {
      status: "waiting_on_customer",
      last_message_at: nowIso,
    };
    if (!ticket.first_response_at) update.first_response_at = nowIso;
    await admin.from("support_tickets").update(update as never).eq("id", ticketId);

    // Email the customer (best-effort).
    try {
      const sender = getEmailSender("support");
      const rendered = renderSupportReplyEmail({
        customerName: ticket.name,
        subject: ticket.subject,
        replyBody: body,
        threadUrl: threadUrlFor(ticket),
        senderName: sender.name,
        senderEmail: sender.email,
      });
      await sendEmail({
        type: "support",
        to: { email: ticket.email, name: ticket.name ?? undefined },
        replyTo: { email: replyToAddress(ticket.public_token), name: sender.name },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: ["support_reply"],
        headers: { "X-Stackivo-Ticket": ticket.id },
      });
    } catch (err) {
      log.warn("support.admin_reply.email_failed", {
        ticketId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  if (ticket.user_id) revalidatePath(`/help/tickets/${ticketId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin: field mutations
// ---------------------------------------------------------------------------

async function adminPatchTicket(
  ticketId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("support_tickets")
    .update(patch as never)
    .eq("id", ticketId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/support/${ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function adminSetStatusAction(ticketId: string, status: TicketStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") {
    patch.resolved_at = new Date().toISOString();
  }
  return adminPatchTicket(ticketId, patch);
}

export async function adminSetPriorityAction(ticketId: string, priority: TicketPriority) {
  return adminPatchTicket(ticketId, { priority });
}

export async function adminSetCategoryAction(ticketId: string, category: TicketCategory) {
  return adminPatchTicket(ticketId, { category });
}

export async function adminAssignAction(ticketId: string, assigneeUserId: string | null) {
  return adminPatchTicket(ticketId, { assignee_user_id: assigneeUserId });
}

export async function adminAddTagAction(ticketId: string, tag: string) {
  await requireAdmin();
  const clean = tag.trim().toLowerCase().slice(0, 40);
  if (!clean) return { ok: false, error: "Empty tag." };
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("support_tickets")
    .select("tags")
    .eq("id", ticketId)
    .maybeSingle();
  const tags = new Set(((data as { tags?: string[] } | null)?.tags ?? []) as string[]);
  tags.add(clean);
  return adminPatchTicket(ticketId, { tags: Array.from(tags) });
}

export async function adminRemoveTagAction(ticketId: string, tag: string) {
  await requireAdmin();
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("support_tickets")
    .select("tags")
    .eq("id", ticketId)
    .maybeSingle();
  const tags = (((data as { tags?: string[] } | null)?.tags ?? []) as string[]).filter(
    (t) => t !== tag,
  );
  return adminPatchTicket(ticketId, { tags });
}

// ---------------------------------------------------------------------------
// Admin: canned responses CRUD
// ---------------------------------------------------------------------------

const cannedSchema = z.object({
  title: z.string().trim().min(2).max(120),
  shortcut: z.string().trim().max(40).optional(),
  body: z.string().trim().min(2).max(8000),
  category: z.enum(CATEGORY_VALUES).optional(),
});

export async function adminCreateCannedAction(input: z.infer<typeof cannedSchema>) {
  await requireAdmin();
  const parsed = cannedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = getAdminSupabase();
  const { error } = await admin.from("support_canned_responses").insert({
    title: parsed.data.title,
    shortcut: parsed.data.shortcut ?? null,
    body: parsed.data.body,
    category: parsed.data.category ?? null,
  } as never);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function adminUpdateCannedAction(
  id: string,
  input: z.infer<typeof cannedSchema>,
) {
  await requireAdmin();
  const parsed = cannedSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const admin = getAdminSupabase();
  const { error } = await admin
    .from("support_canned_responses")
    .update({
      title: parsed.data.title,
      shortcut: parsed.data.shortcut ?? null,
      body: parsed.data.body,
      category: parsed.data.category ?? null,
    } as never)
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function adminDeleteCannedAction(id: string) {
  await requireAdmin();
  const admin = getAdminSupabase();
  const { error } = await admin.from("support_canned_responses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/support");
  return { ok: true };
}
// ---------------------------------------------------------------------------
// Widget: load the user's most recent active conversation (for the launcher)
// ---------------------------------------------------------------------------

export async function getWidgetThreadAction(): Promise<{
  ok: boolean;
  thread: { ticket: SupportTicket; messages: import("./ticket-types").SupportMessage[] } | null;
}> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true, thread: null };

  // Most recent non-closed ticket is the "live" conversation for the widget.
  const { data: ticketRow } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("user_id", user.id)
    .neq("status", "closed")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!ticketRow) return { ok: true, thread: null };
  const ticket = ticketRow as SupportTicket;

  const { data: messages } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticket.id)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: true });

  return {
    ok: true,
    thread: {
      ticket,
      messages: (messages as import("./ticket-types").SupportMessage[] | null) ?? [],
    },
  };
}
