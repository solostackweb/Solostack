import "server-only";

import {
  AI_FIELD_SEQUENCE,
  AI_SKIP_SENTINEL,
  NO_CLIENT_SENTINEL,
  NO_PROJECT_SENTINEL,
  type AiFields,
  type AiMissingField,
  type AiWorkflow,
} from "./types";
import type {
  IvoRuntimePromptBlock,
  IvoWorkflowNextAction,
  IvoWorkflowTool,
} from "./conversation-types";

const WORKFLOW_TOOL: Partial<Record<AiWorkflow, IvoWorkflowTool>> = {
  invoice: "invoice.draft",
  contract: "contract.draft",
  welcome_document: "welcome_document.draft",
  client: "client.create",
  project: "project.create",
  portal: "portal.create_invite",
  time_entry: "time_entry.create",
  meeting: "meeting.create",
  proposal: "proposal.create",
};

export const IVO_MISSING_FIELD_QUESTIONS: Record<string, AiMissingField> = {
  clientId: { field: "clientId", question: "Which client is this for?" },
  fullName: { field: "fullName", question: "What's the client's name?", placeholder: "Example: Riya Sharma" },
  name: { field: "name", question: "What should I name this project?", placeholder: "Example: Website Redesign" },
  workDescription: {
    field: "workDescription",
    question: "What work should I bill for?",
    placeholder: "Example: Landing page design",
  },
  amount: {
    field: "amount",
    question: "What amount should I invoice?",
    placeholder: "Example: 50000",
    tip: "Use the selected client's invoice currency.",
  },
  scope: {
    field: "scope",
    question: "Describe the scope, deliverables, and timeline.",
    placeholder: "Example: 5-page website, CMS setup, 3-week timeline",
  },
  process: {
    field: "process",
    question: "What working style, communication, and process should it cover?",
    placeholder: "Example: Weekly Friday updates, feedback in one doc, replies within a day",
  },
  description: {
    field: "description",
    question: "What work did you do?",
    placeholder: "Example: Client call and wireframe revisions",
  },
  duration: {
    field: "duration",
    question: "How long, and is it billable?",
    placeholder: "Example: 2h 30m, billable",
    suggestions: ["30m, billable", "1h, billable", "2h 30m, billable", "1h, non-billable"],
  },
  question: { field: "question", question: "What do you need help with?" },
  topic: {
    field: "topic",
    question: "What's the call about?",
    placeholder: "Example: Project kickoff",
    suggestions: ["Kickoff call", "Discovery call", "Review call", "Catch-up"],
  },
  meetingLength: {
    field: "meetingLength",
    question: "How long should the call be? Or reply “skip”.",
    placeholder: "Example: 30 minutes",
    optional: true,
    suggestions: ["15 minutes", "30 minutes", "45 minutes", "1 hour"],
  },
  projectId: { field: "projectId", question: "Which project should I link this to? Or choose “No project”." },
  type: {
    field: "type",
    question: "What kind of document is this — agreement, proposal, NDA, or retainer? Or reply “skip”.",
    placeholder: "Example: Service agreement",
    optional: true,
    suggestions: ["Service agreement", "Proposal", "NDA", "Retainer"],
  },
  commercials: {
    field: "commercials",
    question: "What are the fees and payment terms? Or reply “skip”.",
    placeholder: "Example: ₹150000, 50% upfront, balance on delivery",
    optional: true,
    suggestions: ["50% upfront, 50% on delivery", "Full payment upfront", "Monthly retainer"],
    tip: "Splitting payment (e.g. 50% upfront) protects your cash flow and reduces the risk of non-payment.",
  },
  timeline: {
    field: "timeline",
    question: "What's the timeline or key milestones? Or reply “skip”.",
    placeholder: "Example: 3 weeks — design week 1, build weeks 2–3",
    optional: true,
  },
  clauses: {
    field: "clauses",
    question: "Any special clauses, exclusions, or responsibilities? Or reply “skip”.",
    placeholder: "Example: 2 revision rounds, confidentiality, client provides content",
    optional: true,
  },
  relationship: {
    field: "relationship",
    question: "What's the working relationship and what should the client expect? Or reply “skip”.",
    placeholder: "Example: 3-month retainer, monthly check-ins",
    optional: true,
  },
  operations: {
    field: "operations",
    question: "Any payment, scheduling, or logistics details to include? Or reply “skip”.",
    placeholder: "Example: invoices on the 1st, Net 7, Slack for chat",
    optional: true,
  },
  tone: {
    field: "tone",
    question: "What tone should it have — warm, premium, or direct? Or reply “skip”.",
    placeholder: "Example: warm and professional",
    optional: true,
    suggestions: ["Warm and friendly", "Premium and polished", "Direct and concise"],
  },
  email: { field: "email", question: "What's their email address?", placeholder: "Example: rupal@acme.com" },
  billingAddress: {
    field: "billingAddress",
    question: "What's their billing address?",
    placeholder: "Example: 12 MG Road, Indore 452001",
  },
  state: {
    field: "state",
    question: "Which state are they in? (used for GST)",
    placeholder: "Example: Madhya Pradesh",
  },
  phone: {
    field: "phone",
    question: "What's their phone number? Or reply “skip”.",
    placeholder: "Example: +91 98765 43210",
    optional: true,
  },
  notes: {
    field: "notes",
    question: "Any notes to add before I create them? Or reply “skip”.",
    placeholder: "Example: Referred by Anil; prefers email",
    optional: true,
  },
  discount: {
    field: "discount",
    question: "Any discount? Enter an amount or %, or reply “skip”.",
    placeholder: "Example: 5000 or 10%",
    optional: true,
    suggestions: ["No discount", "10%"],
  },
  dueDate: {
    field: "dueDate",
    question: "When is it due? e.g. “in 15 days”, or reply “skip”.",
    placeholder: "Example: in 15 days",
    optional: true,
    suggestions: ["In 7 days", "In 15 days", "In 30 days", "End of month"],
    tip: "Shorter due dates (7–15 days) typically get you paid faster.",
  },
};

export function ivoDiscountQuestion(currency?: string): AiMissingField {
  const cur = (currency || "INR").toUpperCase();
  const flatExample = cur === "INR" ? "₹5000 off" : `${cur} 5 off`;
  return {
    ...IVO_MISSING_FIELD_QUESTIONS.discount,
    question: `Any discount? Enter a ${cur} amount or %, or reply “skip”.`,
    placeholder: cur === "INR" ? "Example: ₹5000 or 10%" : `Example: ${cur} 5 or 10%`,
    suggestions: ["No discount", "10%", flatExample],
  };
}

function answer(fields: AiFields, key: string) {
  const value = fields[key]?.trim() ?? "";
  return value === AI_SKIP_SENTINEL ? "" : value;
}

function amountValue(value: string) {
  const cleaned = value.replace(/,/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|lakhs?|lac|l|crores?|cr)?\b/i);
  if (!match) return 0;
  const number = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "";
  const multiplier = unit.startsWith("k") ? 1e3 : unit.startsWith("c") ? 1e7 : unit ? 1e5 : 1;
  return number * multiplier;
}

function sequenceMissing(
  workflow: AiWorkflow,
  fields: AiFields,
  context: { clientId: string; projectId: string; currency?: string },
) {
  for (const spec of AI_FIELD_SEQUENCE[workflow]) {
    const key = spec.field;
    if (key === "clientId") {
      if (!context.clientId) return IVO_MISSING_FIELD_QUESTIONS.clientId;
      continue;
    }
    if (key === "projectId") {
      if (!context.projectId) {
        return { ...IVO_MISSING_FIELD_QUESTIONS.projectId, optional: !!spec.optional };
      }
      continue;
    }
    if (key === "amount") {
      if (amountValue(answer(fields, key)) <= 0) {
        const currency = (context.currency || "INR").toUpperCase();
        return currency === "INR"
          ? {
              ...IVO_MISSING_FIELD_QUESTIONS.amount,
              question: "What amount should I invoice in INR? (before GST/discount)",
              tip: "For domestic clients, enter the pre-GST INR amount. GST is added automatically based on your and the client's state.",
            }
          : {
              field: "amount",
              question: `What amount should I invoice in ${currency}? (before any discount)`,
              tip: `This is an export invoice, so it's zero-rated — no GST is added. Enter the amount in ${currency}.`,
            };
      }
      continue;
    }

    const skipped = fields[key] === AI_SKIP_SENTINEL;
    const satisfied = skipped || Boolean(answer(fields, key)) ||
      (workflow === "project" && key === "dueDate" && /\b(due|deadline|by)\b/i.test(answer(fields, "dates")));
    if (!satisfied) {
      if (key === "discount") return ivoDiscountQuestion(context.currency);
      const question = IVO_MISSING_FIELD_QUESTIONS[key] ?? {
        field: key,
        question: spec.optional ? `Add ${key}? (or reply skip)` : `Please provide ${key}.`,
      };
      return spec.optional ? { ...question, optional: true } : question;
    }
  }
  return null;
}

export function nextIvoMissingField(input: {
  workflow: AiWorkflow;
  fields: AiFields;
  clientId: string;
  projectId: string;
  currency?: string;
}): AiMissingField | null {
  const { workflow, fields, currency } = input;
  const clientId = input.clientId === NO_CLIENT_SENTINEL ? NO_CLIENT_SENTINEL : input.clientId;
  const projectId = input.projectId === NO_PROJECT_SENTINEL ? NO_PROJECT_SENTINEL : input.projectId;

  if (workflow === "welcome_document") {
    if (!clientId) {
      return { field: "clientId", question: "Which client is this welcome document for?" };
    }
    if (!projectId) return { ...IVO_MISSING_FIELD_QUESTIONS.projectId, optional: true };
    const template = answer(fields, "welcomeTemplate");
    if (!template) {
      return {
        field: "welcomeTemplate",
        question: "Pick a ready-made template to start from — or choose Custom to describe your own.",
      };
    }
    if (template !== "__custom__") return null;
  }

  const missing = sequenceMissing(workflow, fields, { clientId, projectId, currency });
  if (missing) return missing;

  if (workflow === "time_entry" && !projectId) {
    return IVO_MISSING_FIELD_QUESTIONS.projectId;
  }
  return null;
}

export function buildIvoFieldPrompt(
  workflow: AiWorkflow,
  missing: AiMissingField,
  fields?: AiFields,
): IvoRuntimePromptBlock {
  if (missing.field === "clientId") {
    // A contract flow started as a proposal/NDA/retainer should say so — the
    // recipient asked for a proposal and must never be told "contract".
    const contractKind = /proposal/i.test(fields?.type ?? "")
      ? "proposal"
      : /nda/i.test(fields?.type ?? "")
        ? "NDA"
        : /retainer/i.test(fields?.type ?? "")
          ? "retainer"
          : "contract";
    const subject = workflow === "invoice"
      ? "invoice"
      : workflow === "contract"
        ? contractKind
        : workflow === "proposal"
          ? "proposal"
          : workflow === "project"
            ? "project"
            : workflow === "portal"
              ? "portal"
            : workflow === "welcome_document"
              ? "welcome document"
              : "";
    return {
      type: "picker",
      pickerType: "client",
      label: subject ? `Which client is this ${subject} for?` : "Which client is this for?",
      allowSkip: workflow === "project" || workflow === "welcome_document",
    };
  }
  if (missing.field === "projectId") {
    return {
      type: "picker",
      pickerType: "project",
      label: missing.question || "Which project should I link this to?",
      allowSkip: true,
    };
  }
  if (missing.field === "state") {
    return {
      type: "picker",
      pickerType: "state",
      label: missing.question || "Which state are they in?",
      allowSkip: false,
    };
  }
  if (missing.field === "welcomeTemplate") {
    return {
      type: "picker",
      pickerType: "welcome_template",
      label: "Pick a starting point for the welcome document:",
      allowSkip: false,
    };
  }
  const suggestions = missing.optional
    ? [...(missing.suggestions ?? []), "Skip"]
    : missing.suggestions;
  return {
    type: "question",
    content: missing.question,
    placeholder: missing.placeholder,
    optional: Boolean(missing.optional),
    suggestions,
    tip: missing.tip,
  };
}

export function planIvoWorkflowNextAction(input: {
  workflow: AiWorkflow | "general";
  fields: AiFields;
  clientId: string;
  projectId: string;
  currency?: string;
  requestId: string;
}): IvoWorkflowNextAction {
  if (input.workflow === "general" || input.workflow === "support") {
    return { kind: "answer_support" };
  }
  const missing = nextIvoMissingField({
    workflow: input.workflow,
    fields: input.fields,
    clientId: input.clientId,
    projectId: input.projectId,
    currency: input.currency,
  });
  if (missing) {
    return {
      kind: "ask_field",
      field: missing,
      prompt: buildIvoFieldPrompt(input.workflow, missing, input.fields),
    };
  }
  const tool = WORKFLOW_TOOL[input.workflow];
  if (!tool) return { kind: "answer_support" };
  return { kind: "invoke_tool", tool, requestId: input.requestId };
}
