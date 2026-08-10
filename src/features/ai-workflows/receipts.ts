import "server-only";

import { IVO_TOOL_REGISTRY, type IvoToolKey, type IvoToolSpec } from "./tool-registry";

/**
 * Execution receipts — the user-facing answer to "what did Ivo actually do?".
 *
 * The action ledger already records every attempt, but it is an operational
 * table: tool keys, hashes, idempotency keys. Nothing in it is meant to be read
 * by the person whose invoices it describes. A receipt is the same event
 * rendered for them, with a link to the affected record so they can verify the
 * outcome against the canonical data rather than taking the assistant's word
 * for it.
 *
 * That link matters more than it looks. An assistant that says "done" and
 * cannot show you what it touched is asking to be trusted; one that hands you
 * the record is letting you check. For anything financial or externally
 * delivered, the second is the only acceptable posture.
 */

export type IvoReceiptStatus = "succeeded" | "failed" | "cancelled" | "in_progress";

export interface IvoExecutionReceipt {
  /** Ledger row id, stable across retries of the same attempt. */
  id: string;
  toolKey: IvoToolKey;
  risk: IvoToolSpec["risk"];
  entityType: IvoToolSpec["entityType"];
  entityId: string | null;
  status: IvoReceiptStatus;
  /** Whether this action required the user's explicit approval. */
  requiredApproval: boolean;
  approvalState: "not_required" | "required" | "approved" | "rejected";
  occurredAt: string;
  /** Route to the affected record, or null when it has no detail page. */
  href: string | null;
  /** One line, safe to display: never contains client names or document text. */
  summary: string;
}

/**
 * Detail routes by entity type. Time entries and support tickets have no
 * per-record page, so they resolve to null rather than a broken link — a dead
 * link in an audit trail is worse than an honest absence.
 */
const ENTITY_ROUTES: Record<IvoToolSpec["entityType"], ((id: string) => string) | null> = {
  invoice: (id) => `/dashboard/invoices/${id}`,
  contract: (id) => `/dashboard/contracts/${id}`,
  proposal: (id) => `/dashboard/proposals/${id}`,
  meeting: (id) => `/dashboard/meetings/${id}`,
  welcome_document: (id) => `/dashboard/welcome/${id}`,
  client: (id) => `/dashboard/clients/${id}`,
  project: (id) => `/dashboard/projects/${id}`,
  portal: (id) => `/dashboard/portal/${id}`,
  questionnaire: (id) => `/dashboard/questionnaires/${id}`,
  time_entry: null,
  support_ticket: null,
  welcome_document_template: null,
  prepared_action: null,
};

export function receiptHref(
  entityType: IvoToolSpec["entityType"],
  entityId: string | null,
): string | null {
  if (!entityId) return null;
  const route = ENTITY_ROUTES[entityType];
  return route ? route(entityId) : null;
}

/**
 * Human summary per tool. Deliberately free of client names, amounts, and
 * document text: a receipt list is a different retention class from the
 * conversation, and the linked record already holds the detail.
 */
const TOOL_SUMMARIES: Record<IvoToolKey, string> = {
  "invoice.draft": "Drafted an invoice",
  "invoice.unbilled_draft": "Drafted an invoice from unbilled time",
  "contract.draft": "Drafted a contract",
  "proposal.create": "Drafted a proposal",
  "questionnaire.draft": "Drafted a questionnaire",
  "proposal.convert_contract": "Created a contract from an accepted proposal",
  "proposal.convert_project": "Started a project from an accepted proposal",
  "portal.create_invite": "Created a client portal and attempted its invitation",
  "questionnaire.send": "Created a client questionnaire link and attempted delivery",
  "welcome_document.draft": "Drafted a welcome document",
  "client.create": "Created a client",
  "project.create": "Created a project",
  "time_entry.create": "Logged a time entry",
  "meeting.create": "Created a meeting and prepared its client invite",
  "support.forward": "Forwarded a question to support",
  "welcome_document.save_template": "Saved a welcome document template",
  "invoice.refine": "Updated an invoice draft",
  "contract.refine": "Updated a contract draft",
  "questionnaire.refine": "Updated a questionnaire draft",
  "welcome_document.refine": "Updated a welcome document draft",
  "invoice.approve": "Approved an invoice",
  "invoice.mark_paid": "Marked an invoice paid",
  "welcome_document.publish": "Published a welcome document",
  "invoice.email": "Emailed an invoice to the client",
  "proposal.email": "Emailed a proposal to the client",
  "contract.email": "Emailed a contract to the client",
  "welcome_document.email": "Emailed a welcome document to the client",
  "invoice.remind_one": "Sent an overdue payment reminder",
  "invoice.remind_overdue": "Sent overdue payment reminders",
  "prepared_action.send": "Sent a prepared follow-up",
  "prepared_action.dismiss": "Dismissed a prepared follow-up",
  "invoice.whatsapp_prepare": "Prepared an invoice WhatsApp share",
  "contract.whatsapp_prepare": "Prepared a contract WhatsApp share",
  "welcome_document.whatsapp_prepare": "Prepared a welcome document WhatsApp share",
};

/** Maps a ledger status to the receipt vocabulary shown to the user. */
export function receiptStatus(ledgerStatus: string): IvoReceiptStatus {
  switch (ledgerStatus) {
    case "succeeded":
      return "succeeded";
    case "cancelled":
      return "cancelled";
    case "executing":
    case "proposed":
      return "in_progress";
    default:
      // Anything unrecognised is reported as failed rather than assumed fine.
      return "failed";
  }
}

/** A ledger row as read for receipt purposes. */
export interface IvoLedgerRow {
  id: string;
  tool_key: string;
  entity_id: string | null;
  status: string;
  approval_state?: string;
  created_at: string;
}

/**
 * Builds a receipt from a ledger row, or null when the row references a tool
 * that is no longer declared. Returning null rather than guessing keeps a
 * removed tool from appearing in the audit trail with invented metadata.
 */
export function buildIvoReceipt(row: IvoLedgerRow): IvoExecutionReceipt | null {
  const spec = IVO_TOOL_REGISTRY[row.tool_key as IvoToolKey];
  if (!spec) return null;
  return {
    id: row.id,
    toolKey: spec.key,
    risk: spec.risk,
    entityType: spec.entityType,
    entityId: row.entity_id,
    status: receiptStatus(row.status),
    requiredApproval: spec.requiresApproval,
    approvalState:
      row.approval_state === "approved" || row.approval_state === "rejected" ||
      row.approval_state === "required" || row.approval_state === "not_required"
        ? row.approval_state
        : spec.requiresApproval ? "required" : "not_required",
    occurredAt: row.created_at,
    href: receiptHref(spec.entityType, row.entity_id),
    summary: TOOL_SUMMARIES[spec.key],
  };
}
