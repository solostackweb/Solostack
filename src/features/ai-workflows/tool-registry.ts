import "server-only";

/**
 * The single declaration of what every Ivo tool is allowed to do.
 *
 * Until now a tool's policy was implied by which runner it happened to call:
 * `runApprovedEmailTool` wrote `explicit_user_external_delivery`,
 * `runRefinementTool` wrote `internal_draft_refinement_review_after_change`,
 * and so on. That worked, but it meant there was nowhere to answer "which tools
 * can send something to a client?" without reading 2,000 lines and inferring
 * the answer from call sites. A safety property you cannot enumerate is a
 * safety property you cannot audit.
 *
 * This table is load-bearing, not documentation: the runners read `policy` from
 * here rather than taking it as an argument, and `evals/tool-registry.eval.ts`
 * asserts that every tool key in use is declared and that the risk classes imply
 * the right approval requirements. A new tool that forgets to declare itself
 * fails the suite rather than shipping with an undefined policy.
 */

/** Every tool key the Ivo runtime may execute. */
export const IVO_TOOL_KEYS = [
  // Draft creation — a record is created, but nothing leaves the workspace.
  "invoice.draft",
  "invoice.unbilled_draft",
  "contract.draft",
  "proposal.create",
  "welcome_document.draft",
  // Direct creation of workspace records on explicit request.
  "client.create",
  "project.create",
  "time_entry.create",
  "meeting.create",
  "support.forward",
  "welcome_document.save_template",
  // Refinement of an existing owned draft.
  "invoice.refine",
  "contract.refine",
  "welcome_document.refine",
  // State changes on an owned record.
  "invoice.approve",
  "invoice.mark_paid",
  "welcome_document.publish",
  // Something leaves the workspace and reaches a client.
  "invoice.email",
  "contract.email",
  "welcome_document.email",
  "invoice.remind_overdue",
  "prepared_action.send",
  "prepared_action.dismiss",
  // A shareable link is prepared; the user still sends it themselves.
  "invoice.whatsapp_prepare",
  "contract.whatsapp_prepare",
  "welcome_document.whatsapp_prepare",
] as const;

export type IvoToolKey = (typeof IVO_TOOL_KEYS)[number];

/**
 * What a tool can affect, ordered roughly by blast radius.
 *
 * `external_delivery` and `financial` are the two that matter most: the first
 * because it cannot be undone once a client has the email, the second because
 * it changes what the user believes they are owed.
 */
export type IvoToolRisk =
  | "internal_draft"
  | "explicit_creation"
  | "draft_refinement"
  | "status_change"
  | "financial"
  | "external_delivery"
  | "share_preparation";

export interface IvoToolSpec {
  key: IvoToolKey;
  risk: IvoToolRisk;
  entityType:
    | "invoice"
    | "contract"
    | "proposal"
    | "meeting"
    | "welcome_document"
    | "client"
    | "project"
    | "time_entry"
    | "support_ticket"
    | "welcome_document_template"
    | "prepared_action";
  /**
   * Whether the user must explicitly approve this exact action before it runs.
   * Draft creation is exempt because the draft itself IS the approval surface —
   * nothing has left the workspace and the record can be discarded.
   */
  requiresApproval: boolean;
  /** Label written to `ivo_action_attempts.input_summary.policy`. */
  policy: string;
  /**
   * Whether a successful execution must be confirmed by rereading canonical
   * data rather than trusting the mutation's own return value.
   */
  verifyByReread: boolean;
}

function spec(
  key: IvoToolKey,
  entityType: IvoToolSpec["entityType"],
  risk: IvoToolRisk,
  policy: string,
  options: { requiresApproval: boolean; verifyByReread: boolean },
): IvoToolSpec {
  return { key, entityType, risk, policy, ...options };
}

const DRAFT = { requiresApproval: false, verifyByReread: true } as const;
const APPROVED = { requiresApproval: true, verifyByReread: true } as const;

export const IVO_TOOL_REGISTRY: Record<IvoToolKey, IvoToolSpec> = {
  "invoice.draft": spec("invoice.draft", "invoice", "internal_draft", "internal_draft_review_after_creation", DRAFT),
  "invoice.unbilled_draft": spec("invoice.unbilled_draft", "invoice", "internal_draft", "internal_draft_review_after_creation", DRAFT),
  "contract.draft": spec("contract.draft", "contract", "internal_draft", "internal_draft_review_after_creation", DRAFT),
  "proposal.create": spec("proposal.create", "proposal", "internal_draft", "internal_draft_review_after_creation", DRAFT),
  "welcome_document.draft": spec("welcome_document.draft", "welcome_document", "internal_draft", "internal_draft_review_after_creation", DRAFT),

  "client.create": spec("client.create", "client", "explicit_creation", "explicit_user_creation_action", APPROVED),
  "project.create": spec("project.create", "project", "explicit_creation", "explicit_user_creation_action", APPROVED),
  "time_entry.create": spec("time_entry.create", "time_entry", "explicit_creation", "explicit_user_creation_action", APPROVED),
  // Creating a meeting also emails the client its booking link, so this is an
  // external delivery rather than an ordinary workspace-only creation.
  "meeting.create": spec("meeting.create", "meeting", "external_delivery", "explicit_user_external_delivery", APPROVED),
  "support.forward": spec("support.forward", "support_ticket", "explicit_creation", "explicit_user_creation_action", APPROVED),
  "welcome_document.save_template": spec("welcome_document.save_template", "welcome_document_template", "explicit_creation", "explicit_user_creation_action", APPROVED),

  "invoice.refine": spec("invoice.refine", "invoice", "draft_refinement", "internal_draft_refinement_review_after_change", DRAFT),
  "contract.refine": spec("contract.refine", "contract", "draft_refinement", "internal_draft_refinement_review_after_change", DRAFT),
  "welcome_document.refine": spec("welcome_document.refine", "welcome_document", "draft_refinement", "internal_draft_refinement_review_after_change", DRAFT),

  // Approving an invoice moves it to "sent" and makes it a receivable, so it is
  // classed financial rather than a plain status change.
  "invoice.approve": spec("invoice.approve", "invoice", "financial", "explicit_user_status_action", APPROVED),
  "invoice.mark_paid": spec("invoice.mark_paid", "invoice", "financial", "explicit_user_status_action", APPROVED),
  "welcome_document.publish": spec("welcome_document.publish", "welcome_document", "status_change", "explicit_user_status_action", APPROVED),

  "invoice.email": spec("invoice.email", "invoice", "external_delivery", "explicit_user_external_delivery", APPROVED),
  "contract.email": spec("contract.email", "contract", "external_delivery", "explicit_user_external_delivery", APPROVED),
  "welcome_document.email": spec("welcome_document.email", "welcome_document", "external_delivery", "explicit_user_external_delivery", APPROVED),
  "invoice.remind_overdue": spec("invoice.remind_overdue", "invoice", "external_delivery", "explicit_user_bulk_delivery", APPROVED),
  "prepared_action.send": spec("prepared_action.send", "prepared_action", "external_delivery", "explicit_user_external_delivery", APPROVED),
  "prepared_action.dismiss": spec("prepared_action.dismiss", "prepared_action", "status_change", "explicit_user_status_action", APPROVED),

  "invoice.whatsapp_prepare": spec("invoice.whatsapp_prepare", "invoice", "share_preparation", "explicit_user_share_preparation", APPROVED),
  "contract.whatsapp_prepare": spec("contract.whatsapp_prepare", "contract", "share_preparation", "explicit_user_share_preparation", APPROVED),
  "welcome_document.whatsapp_prepare": spec("welcome_document.whatsapp_prepare", "welcome_document", "share_preparation", "explicit_user_share_preparation", APPROVED),
};

/** Risk classes where an action reaches a client or moves money. */
export const HIGH_RISK: ReadonlySet<IvoToolRisk> = new Set<IvoToolRisk>([
  "external_delivery",
  "financial",
]);

/**
 * Resolves a tool's declared policy. Throws on an unknown key rather than
 * defaulting, so a tool cannot execute without an explicit declaration.
 */
export function ivoToolSpec(key: IvoToolKey): IvoToolSpec {
  const found = IVO_TOOL_REGISTRY[key];
  if (!found) {
    throw new Error(`Ivo tool "${key}" has no registry entry — declare it before use.`);
  }
  return found;
}

/** The ledger policy label for a tool. */
export function ivoToolPolicy(key: IvoToolKey): string {
  return ivoToolSpec(key).policy;
}

/**
 * The `approval_state` a tool's ledger row must carry.
 *
 * Derived rather than passed in, so a tool wired to the wrong runner cannot
 * record itself as needing no approval. That is precisely how an external
 * delivery would slip past the gate: not by anyone deciding to skip approval,
 * but by a new tool being added alongside the draft helpers because they looked
 * similar. The declaration is the single source of truth.
 */
export function ivoToolApprovalState(key: IvoToolKey): "approved" | "not_required" {
  return ivoToolSpec(key).requiresApproval ? "approved" : "not_required";
}

/**
 * Fails loudly when a tool is about to execute through a path that does not
 * match its declared risk.
 *
 * Called by the runners before anything is written. A mismatch here means the
 * code and the registry disagree about what an action can do, and continuing
 * would produce an audit trail that misdescribes what happened — worse than no
 * audit trail, because it would be believed.
 */
export function assertIvoToolPath(
  key: IvoToolKey,
  path: "draft" | "approved",
): void {
  const tool = ivoToolSpec(key);
  const expected = tool.requiresApproval ? "approved" : "draft";
  if (expected !== path) {
    throw new Error(
      `Ivo tool "${key}" is declared ${tool.risk} (approval ${tool.requiresApproval ? "required" : "not required"}) ` +
        `but is executing through the "${path}" path. Fix the wiring or the registry — do not skip this check.`,
    );
  }
}
