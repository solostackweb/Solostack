import "server-only";

/**
 * Pure trigger -> typed tool mapping for the automation executor.
 *
 * Kept in its own eval-safe module (no Next runtime, no domain operations) so
 * the eval suite can pin — for every automation trigger — that it resolves to
 * a declared, correctly-gated tool key without importing the executor's
 * session-bound domain operations. The executor builds its runnable closures
 * on top of this table.
 */

import type { IvoToolKey } from "@/features/ai-workflows/tool-registry";
import type { AutomationTriggerKey } from "./evaluator-core";

export const AUTOMATION_TRIGGER_TOOL: Record<AutomationTriggerKey, IvoToolKey> = {
  invoice_overdue_followup: "invoice.remind_one",
  invoice_due_soon_review: "invoice.remind_one",
  unbilled_time_invoice: "invoice.unbilled_draft",
  proposal_followup: "proposal.email",
  contract_expiry_followup: "contract.email",
};

/**
 * Triggers whose execution reaches a client (and therefore must require the
 * user's explicit approval before the run is claimed and sent).
 */
export const AUTOMATION_EXTERNAL_TRIGGERS: ReadonlySet<AutomationTriggerKey> =
  new Set<AutomationTriggerKey>([
    "invoice_overdue_followup",
    "invoice_due_soon_review",
    "proposal_followup",
    "contract_expiry_followup",
  ]);

/** Triggers that only create a workspace draft (nothing leaves the workspace). */
export const AUTOMATION_DRAFT_TRIGGERS: ReadonlySet<AutomationTriggerKey> =
  new Set<AutomationTriggerKey>(["unbilled_time_invoice"]);