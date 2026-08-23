import "server-only";

import { z } from "zod";

import { AI_SKIP_SENTINEL, type AiFields, type AiInterpretation } from "./types";
import { IVO_WORKFLOW_TOOLS, type IvoMode, type IvoRuntimeDecision } from "./conversation-types";
import { planIvoWorkflowNextAction } from "./workflow-progress";

const missingFieldSchema = z.object({
  field: z.string().min(1).max(100),
  question: z.string().min(1).max(2000),
  placeholder: z.string().max(1000).optional(),
  optional: z.boolean().optional(),
  suggestions: z.array(z.string().max(200)).max(10).optional(),
  tip: z.string().max(1000).optional(),
});
const promptBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("question"),
    content: z.string().min(1).max(2000),
    placeholder: z.string().max(1000).optional(),
    optional: z.boolean(),
    suggestions: z.array(z.string().max(200)).max(10).optional(),
    tip: z.string().max(1000).optional(),
  }),
  z.object({
    type: z.literal("picker"),
    pickerType: z.enum(["client", "project", "state", "welcome_template"]),
    label: z.string().min(1).max(2000),
    allowSkip: z.boolean(),
  }),
]);
const workflowNextActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ask_field"),
    field: missingFieldSchema,
    prompt: promptBlockSchema,
  }),
  z.object({
    kind: z.literal("invoke_tool"),
    tool: z.enum(IVO_WORKFLOW_TOOLS),
    requestId: z.string().uuid(),
  }),
  z.object({ kind: z.literal("answer_support") }),
]);

export const ivoRuntimeDecisionSchema = z.union([
  z.object({ kind: z.literal("reply") }),
  z.object({ kind: z.literal("list"), entityType: z.literal("invoice"), filter: z.enum(["unpaid", "overdue", "all"]) }),
  z.object({ kind: z.literal("list"), entityType: z.literal("contract"), filter: z.enum(["pending", "all"]) }),
  z.object({ kind: z.literal("list"), entityType: z.literal("proposal"), filter: z.enum(["pending", "all"]) }),
  z.object({ kind: z.literal("list"), entityType: z.literal("client"), filter: z.literal("all") }),
  z.object({ kind: z.literal("list"), entityType: z.literal("project"), filter: z.enum(["active", "all"]) }),
  z.object({ kind: z.literal("list"), entityType: z.literal("meeting"), filter: z.enum(["upcoming", "awaiting", "all"]) }),
  z.object({ kind: z.literal("list"), entityType: z.literal("welcome_document"), filter: z.enum(["open", "all"]) }),
  z.object({ kind: z.literal("business_query") }),
  z.object({ kind: z.literal("support") }),
  z.object({ kind: z.literal("questionnaire"), projectId: z.string().uuid().optional() }),
  z.object({
    kind: z.literal("project_followup"),
    clientId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
  }),
  z.object({
    kind: z.literal("refine"),
    entityType: z.enum(["invoice", "contract", "questionnaire", "welcome_document"]),
    entityId: z.string().uuid(),
  }),
  z.object({
    kind: z.literal("overdue_reminders"),
    action: z.enum(["propose", "execute", "dismiss"]),
  }),
  z.object({
    kind: z.literal("unbilled_invoice"),
    send: z.boolean(),
    clientId: z.string().uuid().optional(),
  }),
  z.object({ kind: z.literal("field_error"), message: z.string().min(1).max(2000) }),
  z.object({
    kind: z.literal("workflow"),
    targetMode: z.enum(["general", "invoice", "contract", "proposal", "welcome_document", "client", "project", "portal", "time_entry", "meeting", "support"]),
    switching: z.boolean(),
    fields: z.record(z.string()),
    clientId: z.string().max(100),
    projectId: z.string().max(100),
    nextAction: workflowNextActionSchema,
  }),
]);

const BUSINESS_DATA_QUESTION =
  /\b(how much|how many|revenue|earned?|earnings|income|turnover|sales|paid|unpaid|owe[sd]?|outstanding|overdue|unbilled|receivable|receivables|collected|collection|collections|follow ?up|followups?|this month|last month|this year|this quarter|top clients?|best clients?|biggest clients?|largest clients?|top customers?|best customers?|top customer|best customer|made|balance due|collection rate|collection plan|concentration|risk|cash ?flow|business summary|how am i doing|health|focus|attention|what needs attention|what should i focus on|what should i do today|priorit(?:y|ies)|today'?s focus|today'?s priorities)\b/;
const PRICING_QUESTION = /\b(price|pricing|plan|plans|cost|subscription|upgrade)\b/;
const QUESTIONNAIRE_REQUEST = /\b(questionnaire|intake form|discovery form|client brief(?:ing)? form)\b/i;
const QUESTIONNAIRE_ACTION = /\b(help(?: me)?|create|draft|prepare|build|make|generate|set up|write)\b/i;
const FOLLOWUP_ACTION = /\b(send|write|draft|prepare|create|make|help(?: me)?(?: write)?)\b/i;
const FOLLOWUP_REQUEST = /\b(remind(?:er)?|follow[ -]?up|check[ -]?in|nudge)\b/i;
const PAYMENT_FOLLOWUP = /\b(invoice|payment|paid|unpaid|overdue|outstanding|past[- ]?due|money|amount)\b/i;

export function isQuestionnaireCreationRequest(message: string): boolean {
  return QUESTIONNAIRE_REQUEST.test(message) && QUESTIONNAIRE_ACTION.test(message);
}

export function isProjectFollowupRequest(message: string): boolean {
  return (
    FOLLOWUP_ACTION.test(message) &&
    FOLLOWUP_REQUEST.test(message) &&
    !PAYMENT_FOLLOWUP.test(message)
  );
}

function isBusinessDataQuestion(text: string) {
  const normalized = text.trim().toLowerCase();
  return !PRICING_QUESTION.test(normalized) && BUSINESS_DATA_QUESTION.test(normalized);
}

/**
 * Creating an invoice from tracked time is a mutation-oriented workflow. Keep
 * advisory questions such as "What unbilled time should I invoice?" on the
 * read-only business-query path, even though they contain the word "invoice".
 */
export function isUnbilledTimeInvoiceAction(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!/\bunbilled\b/.test(normalized) || !/\b(invoice|bill)\b/.test(normalized)) {
    return false;
  }

  const asksForAdvice =
    /\b(what|which|how much|should|recommend|review|show|check|tell me|ready)\b/.test(normalized);
  const explicitCreation =
    /\b(create|draft|prepare|generate|raise|make)\b[^.?!]*\b(invoice|bill)\b/.test(normalized);

  if (asksForAdvice && !explicitCreation) return false;
  return (
    explicitCreation ||
    /^(?:please\s+)?(?:invoice|bill)\b/.test(normalized) ||
    /\b(?:invoice|bill)\s+(?:all\s+|my\s+|the\s+|this\s+|these\s+)?unbilled\s+(?:time|hours?)\b/.test(normalized)
  );
}

export function meetingListFilter(message: string): "upcoming" | "awaiting" | "all" | null {
  const normalized = message.trim().toLowerCase();
  const mentionsMeetings = /\b(meetings?|calls?|calendar|schedule)\b/.test(normalized);
  const listCommand = /\b(show|list|view|see|check|review)\b/.test(normalized);
  const ownedScheduleQuestion =
    /\b(?:what|which)\s+(?:meetings?|calls?)\s+(?:do\s+i\s+have|are\s+(?:coming\s+up|upcoming|scheduled))\b/.test(normalized) ||
    /\bdo\s+i\s+have\s+(?:any\s+)?(?:(?:upcoming|scheduled)\s+)?(?:meetings?|calls?)\b/.test(normalized) ||
    /\bwhen(?:'s| is)\s+my\s+next\s+(?:meeting|call)\b/.test(normalized) ||
    /\bwhat(?:'s| is)\s+(?:on|in)\s+my\s+(?:calendar|schedule)\b/.test(normalized) ||
    /\bmy\s+(?:next|upcoming|scheduled)\s+(?:meetings?|calls?)\b/.test(normalized);
  if (!mentionsMeetings || (!listCommand && !ownedScheduleQuestion)) {
    return null;
  }
  if (/\b(all|past|history|completed|cancelled)\b/.test(normalized)) return "all";
  if (/\b(awaiting|unconfirmed|needs? to (pick|choose)|pick a time)\b/.test(normalized)) {
    return "awaiting";
  }
  return "upcoming";
}

/** A list decision narrowed from the runtime union, for direct reuse. */
export type IvoListDecision = Extract<IvoRuntimeDecision, { kind: "list" }>;

/**
 * Recognises pure list requests ("show my invoices") that need no model round.
 * Deliberately conservative: anything ambiguous returns null and falls through
 * to the agent. Shared by the fallback planner and the pre-model fast lane in
 * conversation-actions.ts so both paths agree on what counts as a list request.
 */
export function listDecision(text: string): IvoListDecision | null {
  const normalized = text.trim().toLowerCase();
  const show = /\b(show|list|view|see|check|review)\b/.test(normalized);
  const portalPlanning =
    /\bportals?\b/.test(normalized) &&
    /\b(who|which|needs?|should|recommend|next|gap|review|compare)\b/.test(normalized) &&
    /\b(clients?|customers?)\b/.test(normalized);
  const meetingFilter = meetingListFilter(text);
  if (meetingFilter) {
    return { kind: "list", entityType: "meeting", filter: meetingFilter };
  }
  if (show && /\binvoices?\b/.test(normalized)) {
    return {
      kind: "list",
      entityType: "invoice",
      filter: /overdue/.test(normalized) ? "overdue" : /\ball\b/.test(normalized) ? "all" : "unpaid",
    };
  }
  if (show && /\bproposals?\b/.test(normalized)) {
    return {
      kind: "list",
      entityType: "proposal",
      filter: /\b(all|every)\b/.test(normalized) ? "all" : "pending",
    };
  }
  if (show && /\bcontracts?\b/.test(normalized)) {
    return {
      kind: "list",
      entityType: "contract",
      filter: /\b(all|every)\b/.test(normalized) ? "all" : "pending",
    };
  }
  if (show && !portalPlanning && /\b(clients?|customers?)\b/.test(normalized)) {
    return { kind: "list", entityType: "client", filter: "all" };
  }
  if (
    /\b(show|list|view|see|review)\b/.test(normalized) &&
    /\b(projects?|engagements?|work)\b/.test(normalized)
  ) {
    return {
      kind: "list",
      entityType: "project",
      filter: /\b(all|every|completed|archived|cancelled)\b/.test(normalized) ? "all" : "active",
    };
  }
  if (
    /\b(show|list|view|see|review|attention)\b/.test(normalized) &&
    /\b(welcome|onboarding)\b/.test(normalized) &&
    /\b(docs?|documents?|guides?)\b/.test(normalized)
  ) {
    return {
      kind: "list",
      entityType: "welcome_document",
      filter: /\b(all|every|archived)\b/.test(normalized) ? "all" : "open",
    };
  }
  return null;
}

export function planIvoRuntime(input: {
  message: string;
  interpretation: AiInterpretation;
  currentMode: IvoMode;
  collected: AiFields;
  pendingField?: { field: string; optional?: boolean };
  clientId: string;
  projectId: string;
  clientCurrency?: string;
  requestId: string;
  pendingProposal?: "overdue_reminders";
  activeDraft?: { entityType: "invoice" | "contract" | "questionnaire" | "welcome_document"; entityId: string };
}): IvoRuntimeDecision {
  const {
    message,
    interpretation,
    currentMode,
    collected,
    pendingField,
    clientId,
    projectId,
    clientCurrency,
    requestId,
    pendingProposal,
    activeDraft,
  } = input;
  const normalized = message.trim().toLowerCase().replace(/[!.]+$/g, "");

  if (!pendingField) {
    if (isQuestionnaireCreationRequest(message)) {
      return {
        kind: "questionnaire",
        ...(z.string().uuid().safeParse(projectId).success ? { projectId } : {}),
      };
    }
    if (isProjectFollowupRequest(message)) {
      const resolvedClientId = interpretation.clientId || clientId;
      if (z.string().uuid().safeParse(resolvedClientId).success) {
        return {
          kind: "project_followup",
          clientId: resolvedClientId,
          ...(z.string().uuid().safeParse(projectId).success ? { projectId } : {}),
        };
      }
    }
    if (pendingProposal === "overdue_reminders") {
      if (/^(yes,? send reminders|yes|send( them)?|go ahead|do it|confirm)$/.test(normalized)) {
        return { kind: "overdue_reminders", action: "execute" };
      }
      if (/^(not now|no|cancel|no thanks?)$/.test(normalized)) {
        return { kind: "overdue_reminders", action: "dismiss" };
      }
    }
    if (
      /\b(send|chase|remind)\b/.test(normalized) &&
      /(reminder|overdue|unpaid|outstanding|past[- ]?due)/.test(normalized)
    ) {
      return { kind: "overdue_reminders", action: "propose" };
    }
    if (isUnbilledTimeInvoiceAction(message)) {
      return {
        kind: "unbilled_invoice",
        send: /\bsend\b/.test(normalized),
        ...(interpretation.clientId ? { clientId: interpretation.clientId } : {}),
      };
    }
    if (/\bunbilled\b/.test(normalized)) {
      return { kind: "business_query" };
    }
    const list = listDecision(message);
    if (list) return list;
    if (interpretation.intent === "query" || isBusinessDataQuestion(message)) {
      return { kind: "business_query" };
    }
    if (interpretation.intent === "support" && interpretation.confident) {
      return { kind: "support" };
    }
    if (activeDraft) {
      const switchingAway =
        interpretation.confident &&
        interpretation.intent !== "general" &&
        interpretation.intent !== activeDraft.entityType;
      const startsNew = activeDraft.entityType === "contract"
        ? /\b(create|draft|start|generate|prepare|make)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(contract|proposal|agreement)\b/i.test(message) ||
          /\b(new|another|second|separate|different)\s+(contract|proposal|agreement)\b/i.test(message)
        : activeDraft.entityType === "invoice"
          ? /\b(create|draft|make|generate|raise|new|another)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(invoice|bill)\b/i.test(message) ||
            /\b(new|another|second|separate|different)\s+invoice\b/i.test(message)
          : activeDraft.entityType === "questionnaire"
            ? /\b(create|draft|make|generate|new|another)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?questionnaire\b/i.test(message) ||
              /\b(new|another)\s+questionnaire\b/i.test(message)
            : /\b(create|draft|make|generate|prepare|new|another)\s+(a\s+|an\s+|another\s+|new\s+)?(new\s+)?(welcome|onboarding)\b/i.test(message) ||
              /\b(new|another)\s+(welcome|onboarding)\b/i.test(message);
      if (!switchingAway && !startsNew) {
        return { kind: "refine", ...activeDraft };
      }
    }
  }

  let targetMode = currentMode;
  const intent = interpretation.intent;
  if (currentMode === "general") {
    targetMode = intent === "support" || intent === "general" || intent === "query"
      ? "general"
      : intent;
  } else {
    const explicitSwitch =
      /\b(create|make|draft|add|new|start|log|raise|generate|prepare|switch to|instead)\b/.test(
        message.toLowerCase(),
      );
    const maySwitch = !pendingField || pendingField.field === "clientId" || explicitSwitch;
    if (
      interpretation.confident &&
      intent !== "general" &&
      intent !== "query" &&
      intent !== currentMode &&
      maySwitch
    ) {
      targetMode = intent;
    }
  }

  const switching = targetMode !== currentMode;
  const baseFields: AiFields = switching ? {} : { ...collected };
  let fields: AiFields;
  if (!switching && pendingField && pendingField.field !== "clientId") {
    const normalized = interpretation.fields?.[pendingField.field]?.trim();
    const skipping = Boolean(pendingField.optional && isSkipReply(message));
    if (!skipping && !normalized) {
      const error = fieldValidationError(pendingField.field, message);
      if (error) return { kind: "field_error", message: error };
    }
    fields = {
      ...baseFields,
      [pendingField.field]: skipping ? AI_SKIP_SENTINEL : normalized || message,
    };
  } else {
    fields = { ...baseFields, ...(interpretation.fields ?? {}) };
  }

  const resolvedClientId = interpretation.clientId || (switching ? "" : clientId);
  const resolvedProjectId = interpretation.projectId || (switching ? "" : projectId);
  const nextAction = planIvoWorkflowNextAction({
    workflow: targetMode,
    fields,
    clientId: resolvedClientId,
    projectId: resolvedProjectId,
    currency: clientCurrency,
    requestId,
  });

  return {
    kind: "workflow",
    targetMode,
    switching,
    fields,
    clientId: resolvedClientId,
    projectId: resolvedProjectId,
    nextAction,
  };
}

/**
 * Whether a raw reply is a skip word. Shared by the fallback planner (where it
 * drives the sentinel) and the agent-path field merge (where it normalises the
 * model's literal "skip" passthroughs back into the sentinel), so a skip can
 * never poison field state regardless of which brain handled the turn.
 */
export function isSkipReply(text: string) {
  return /^(skip|none|no|n\/a|na|nope|nah|leave it|not now|-|—)$/i.test(text.trim());
}

/**
 * Field values exactly equal to a skip word become the sentinel. Without this,
 * a model that passes "skip" through as a literal value (it is told to take
 * field answers literally) poisons the collected state: the value reads as
 * answered until a downstream check rejects it, and the workflow loops on a
 * field the user already chose to skip.
 */
export function normalizeSkipFieldValues(fields: AiFields): AiFields {
  const out: AiFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = isSkipReply(value) ? AI_SKIP_SENTINEL : value;
  }
  return out;
}

function fieldValidationError(field: string, text: string): string | null {
  const value = text.trim();
  const hasNumber = /\d/.test(value);
  if (field === "amount" && !hasNumber) {
    return "I need a number for the amount, in the selected client's invoice currency. For example: 50000, 1.5L, or 1200. How much should I invoice?";
  }
  if (field === "duration" && !hasNumber) {
    return "Tell me how long in hours/minutes — for example “2h 30m” or “45m”. And is it billable?";
  }
  if (
    field === "dueDate" &&
    !hasNumber &&
    !/\b(today|tomorrow|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eom|end of)\b/i.test(value)
  ) {
    return "When is it due? Try “in 15 days”, “next month”, a date like 2026-07-01 — or reply “skip”.";
  }
  if (field === "email" && !/^\S+@\S+\.\S+$/.test(value)) {
    return "That doesn't look like an email address — for example “name@company.com”. What's their email?";
  }
  return null;
}
