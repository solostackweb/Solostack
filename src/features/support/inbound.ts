import "server-only";

/**
 * Inbound support email → ticket ingestion.
 *
 * The Cloudflare Email Worker (see infra/cloudflare-email-worker) parses an
 * incoming message to support@ / support+<token>@stackivo.me and POSTs a small
 * JSON payload to /api/support/inbound. This module turns that into a
 * first-party customer message:
 *
 *   1. Match the ticket by plus-address token, else by the sender's most
 *      recent open ticket; otherwise open a NEW guest ticket.
 *   2. Dedupe on the RFC Message-ID (unique index on external_message_id).
 *   3. Append as a customer message + reopen the ticket (waiting_on_us).
 *
 * Service-role only.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import type { SupportTicket } from "./ticket-types";

export interface InboundEmail {
  /** Plus-address token (support+<token>@…), when present. */
  token?: string | null;
  /** RFC 5322 Message-ID — used to dedupe re-deliveries. */
  messageId?: string | null;
  /** Sender address. */
  from: string;
  fromName?: string | null;
  subject?: string | null;
  /** Parsed plain-text body. */
  text: string;
}

export interface InboundResult {
  ok: boolean;
  ticketId?: string;
  action?: "appended" | "created" | "duplicate";
  error?: string;
}

/** Trim the most common quoted-reply trailers so we keep just the new text. */
function stripQuoted(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;
    if (/^-{3,}\s*Original Message\s*-{3,}/i.test(line)) break;
    if (/^_{5,}\s*$/.test(line)) break;
    if (/^\s*From:\s.+/.test(line) && out.length > 0) break;
    out.push(line);
  }
  const trimmed = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return trimmed || text.trim();
}

export async function ingestInboundEmail(input: InboundEmail): Promise<InboundResult> {
  const admin = getAdminSupabase();
  const from = input.from.trim().toLowerCase();
  if (!from) return { ok: false, error: "missing_sender" };

  const body = stripQuoted(input.text || "").slice(0, 8000);
  if (!body) return { ok: false, error: "empty_body" };

  // 1. Resolve the ticket.
  let ticket: SupportTicket | null = null;

  if (input.token) {
    const { data } = await admin
      .from("support_tickets")
      .select("*")
      .eq("public_token", input.token)
      .maybeSingle();
    ticket = (data as SupportTicket | null) ?? null;
  }

  if (!ticket) {
    // Most recent non-closed ticket from this sender.
    const { data } = await admin
      .from("support_tickets")
      .select("*")
      .eq("email", from)
      .neq("status", "closed")
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    ticket = (data as SupportTicket | null) ?? null;
  }

  // 2. Open a new guest ticket if nothing matched.
  if (!ticket) {
    // Link to an existing account if this email belongs to one.
    const { data: prof } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .eq("email", from)
      .maybeSingle();
    const profile = prof as { id?: string; full_name?: string | null } | null;

    const nowIso = new Date().toISOString();
    const subject = (input.subject || "").replace(/^(re|fwd):\s*/i, "").trim() || `Email from ${from}`;
    const { data: created, error: createErr } = await admin
      .from("support_tickets")
      .insert({
        user_id: profile?.id ?? null,
        email: from,
        name: input.fromName ?? profile?.full_name ?? null,
        subject: subject.slice(0, 200),
        status: "new",
        priority: "normal",
        category: null,
        plan_at_creation: "free",
        channel: "email",
        last_message_at: nowIso,
        last_customer_message_at: nowIso,
      } as never)
      .select("*")
      .single();
    if (createErr || !created) {
      log.error("support.inbound.create_failed", { error: createErr?.message });
      return { ok: false, error: "create_failed" };
    }
    ticket = created as SupportTicket;
  }

  // 3. Insert the message (dedupe on Message-ID via unique index).
  const { error: msgErr } = await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    author_type: "customer",
    body,
    via: "email",
    external_message_id: input.messageId ?? null,
  } as never);

  if (msgErr) {
    // Unique violation = we already ingested this Message-ID.
    if (msgErr.code === "23505") {
      return { ok: true, ticketId: ticket.id, action: "duplicate" };
    }
    log.error("support.inbound.message_failed", { error: msgErr.message });
    return { ok: false, error: "message_failed" };
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("support_tickets")
    .update({
      status: "waiting_on_us",
      last_message_at: nowIso,
      last_customer_message_at: nowIso,
    } as never)
    .eq("id", ticket.id);

  return { ok: true, ticketId: ticket.id, action: "appended" };
}
