import type { AiFields, AiMissingField } from "./types";
import type { Json } from "@/lib/supabase/types";

export const IVO_MODES = [
  "general",
  "invoice",
  "contract",
  "proposal",
  "welcome_document",
  "client",
  "project",
  "time_entry",
  "meeting",
  "support",
] as const;

export type IvoMode = (typeof IVO_MODES)[number];

export const IVO_WORKFLOW_TOOLS = [
  "invoice.draft",
  "contract.draft",
  "welcome_document.draft",
  "client.create",
  "project.create",
  "time_entry.create",
  "meeting.create",
  "proposal.create",
] as const;

export type IvoWorkflowTool = (typeof IVO_WORKFLOW_TOOLS)[number];
export type IvoRuntimePromptBlock =
  | {
      type: "question";
      content: string;
      placeholder?: string;
      optional: boolean;
      suggestions?: string[];
      tip?: string;
    }
  | {
      type: "picker";
      pickerType: "client" | "project" | "state" | "welcome_template";
      label: string;
      allowSkip: boolean;
    };
export type IvoWorkflowNextAction =
  | { kind: "ask_field"; field: AiMissingField; prompt: IvoRuntimePromptBlock }
  | { kind: "invoke_tool"; tool: IvoWorkflowTool; requestId: string }
  | { kind: "answer_support" };

export interface IvoWorkflowState {
  version: 1;
  mode: IvoMode;
  collected: AiFields;
  pendingField: AiMissingField | null;
  pendingConfirmation: IvoPendingConfirmation | null;
  pendingProposal: "overdue_reminders" | null;
  clientId: string;
  projectId: string;
}

export interface IvoPersistedMessage {
  id: string;
  role: "user" | "assistant";
  kind: "text" | "question" | "picker" | "preview" | "confirmation" | "error" | "result";
  content: string;
  suggestions?: string[];
  tip?: string;
  block?: IvoResolvedMessageBlock;
  createdAt: string;
}

export type IvoMessageBlockEntity = "invoice" | "contract" | "welcome_document";
export type IvoMessageBlockVariant = "draft" | "delivery";

export type IvoMessageBlockReference =
  | {
      type: "entity_preview";
      entityType: IvoMessageBlockEntity;
      entityId: string;
      variant: IvoMessageBlockVariant;
    }
  | {
      type: "picker";
      pickerType: "client" | "project" | "state" | "welcome_template";
      label: string;
      allowSkip: boolean;
    }
  | {
      type: "entity_list";
      entityType: "invoice" | "contract" | "proposal" | "client" | "project" | "welcome_document";
      entityIds: string[];
    }
  | {
      type: "entity_result";
      entityType: "client" | "project" | "time_entry" | "proposal" | "questionnaire" | "meeting" | "portal";
      entityId: string;
      contextId?: string;
    }
  | {
      type: "confirmation";
      requestId: string;
    };

export type IvoResolvedMessageBlock = IvoMessageBlockReference & { data: Json };

/**
 * The canonical, server-authored description of what a tool outcome should
 * become in the conversation. The panel renders and persists this verbatim; it
 * never invents message kind, copy, or block identity for a tool result.
 *
 * `block` is omitted for outcomes that have no resumable card — a completed
 * delivery or share preparation is a durable fact in the action ledger, and
 * replaying it as an actionable card on resume would invite a duplicate send.
 */
export interface IvoToolResponseDescriptor {
  kind: "preview" | "confirmation" | "result";
  content: string;
  block?: IvoMessageBlockReference;
}

export interface IvoConfirmationSummary {
  kind: "client" | "project" | "time_entry" | "meeting";
  title: string;
  lines: Array<[label: string, value: string]>;
}

export interface IvoPendingConfirmation {
  workflow: "client" | "project" | "time_entry" | "meeting";
  tool: Extract<IvoWorkflowTool, "client.create" | "project.create" | "time_entry.create" | "meeting.create">;
  fields: AiFields;
  cId: string;
  pId: string;
  toolRequestKey: string;
  summary: IvoConfirmationSummary;
}

export interface IvoConversationSnapshot {
  id: string;
  title: string | null;
  state: IvoWorkflowState;
  messages: IvoPersistedMessage[];
}

export interface IvoConversationListItem {
  id: string;
  title: string;
  status: "active" | "archived";
  lastMessageAt: string;
  createdAt: string;
}

export type IvoRuntimeDecision =
  /** The agent already answered in `say` — nothing further to execute. */
  | { kind: "reply" }
  | { kind: "list"; entityType: "invoice"; filter: "unpaid" | "overdue" | "all" }
  | { kind: "list"; entityType: "contract"; filter: "pending" | "all" }
  | { kind: "list"; entityType: "proposal"; filter: "pending" | "all" }
  | { kind: "list"; entityType: "client"; filter: "all" }
  | { kind: "list"; entityType: "project"; filter: "active" | "all" }
  | { kind: "list"; entityType: "welcome_document"; filter: "open" | "all" }
  | { kind: "business_query" }
  | { kind: "support" }
  | { kind: "refine"; entityType: IvoMessageBlockEntity | "questionnaire"; entityId: string }
  | { kind: "overdue_reminders"; action: "propose" | "execute" | "dismiss" }
  | { kind: "unbilled_invoice"; send: boolean; clientId?: string }
  | { kind: "field_error"; message: string }
  | {
      kind: "workflow";
      targetMode: IvoMode;
      switching: boolean;
      fields: AiFields;
      clientId: string;
      projectId: string;
      nextAction: IvoWorkflowNextAction;
    };

export const EMPTY_IVO_WORKFLOW_STATE: IvoWorkflowState = {
  version: 1,
  mode: "general",
  collected: {},
  pendingField: null,
  pendingConfirmation: null,
  pendingProposal: null,
  clientId: "",
  projectId: "",
};
