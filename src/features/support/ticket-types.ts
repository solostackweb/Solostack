/**
 * First-party support system — shared types.
 *
 * Mirrors the columns of `public.support_tickets`, `public.support_messages`,
 * and `public.support_canned_responses` (migration 0047). Dependency-free so
 * it can be imported from both server and client modules.
 *
 * This replaces the Crisp/Zoho-oriented `types.ts` (legacy `support_threads`).
 */

export type SupportPlan = "free" | "pro" | "business";

export type TicketStatus =
  | "new"
  | "open"
  | "waiting_on_customer"
  | "waiting_on_us"
  | "resolved"
  | "closed";

export type TicketPriority = "low" | "normal" | "high" | "urgent";

/** Six-category taxonomy (kept stable from the legacy system). */
export type TicketCategory =
  | "billing"
  | "bug"
  | "how-to"
  | "feature-request"
  | "account"
  | "onboarding";

export type TicketChannel = "in_app" | "chat" | "email" | "contact_form";

export type MessageAuthorType = "customer" | "agent" | "system" | "ai";

export type MessageVia = "in_app" | "chat" | "email";

/** A single stored attachment reference (object in `support-attachments`). */
export interface SupportAttachment {
  /** Storage object path: `<user_id>/<ticket_id>/<filename>`. */
  path: string;
  name: string;
  size: number;
  contentType: string;
}

export interface SupportTicket {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory | null;
  plan_at_creation: SupportPlan;
  assignee_user_id: string | null;
  tags: string[];
  channel: TicketChannel;
  /** Guest access + inbound-email correlation token. */
  public_token: string;
  source_page: string | null;
  trace_id: string | null;
  sla_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  last_message_at: string;
  last_customer_message_at: string;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  author_type: MessageAuthorType;
  author_user_id: string | null;
  body: string;
  attachments: SupportAttachment[];
  via: MessageVia;
  external_message_id: string | null;
  is_internal_note: boolean;
  created_at: string;
}

export interface SupportCannedResponse {
  id: string;
  title: string;
  shortcut: string | null;
  body: string;
  category: TicketCategory | null;
  created_at: string;
  updated_at: string;
}

/** A ticket plus its (customer-visible) messages — the chat/thread view. */
export interface SupportThreadView {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** New ticket from the in-app form / chat / marketing contact form. */
export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  message: string;
  /** Channel the ticket originated from. */
  channel?: TicketChannel;
  /** Page the user was on (auto-filled client-side). */
  page?: string;
  /** Required for guest (logged-out) submissions. */
  email?: string;
  name?: string;
}

export interface CreateTicketResult {
  ok: boolean;
  ticketId?: string;
  /** Guest token so the contact form can deep-link to the thread. */
  publicToken?: string;
  error?: string;
}

export interface AddMessageInput {
  ticketId: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Tier-wise support policy (see HELP_SUPPORT_REBUILD_PLAN §5)
// ---------------------------------------------------------------------------

export interface TierSupportPolicy {
  plan: SupportPlan;
  /** Human-readable first-response target shown to the customer. */
  slaLabel: string;
  /** First-response target in hours (null = best-effort, no promise). */
  slaHours: number | null;
  /** Whether live chat is offered "online" (vs leave-a-message). */
  liveChat: boolean;
  /** Base queue weight — higher sorts first in the admin inbox. */
  queueWeight: number;
}

export const TIER_SUPPORT_POLICY: Record<SupportPlan, TierSupportPolicy> = {
  free: {
    plan: "free",
    slaLabel: "Best-effort",
    slaHours: null,
    liveChat: false,
    queueWeight: 0,
  },
  pro: {
    plan: "pro",
    slaLabel: "Within ~24 hours",
    slaHours: 24,
    liveChat: true,
    queueWeight: 10,
  },
  business: {
    plan: "business",
    slaLabel: "Within ~4–8 hours",
    slaHours: 6,
    liveChat: true,
    queueWeight: 20,
  },
};

/** Compute the SLA due timestamp for a plan from a start time. */
export function computeSlaDueAt(plan: SupportPlan, fromIso: string): string | null {
  const policy = TIER_SUPPORT_POLICY[plan];
  if (policy.slaHours == null) return null;
  return new Date(new Date(fromIso).getTime() + policy.slaHours * 3_600_000).toISOString();
}
