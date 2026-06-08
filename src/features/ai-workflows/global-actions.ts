"use server";

import { redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { z } from "zod";

import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { env } from "@/config/env";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/server";
import { nextInvoiceNumber, getInvoice } from "@/features/invoices/server";
import { createInvoiceAction, setInvoiceStatusAction, updateInvoiceAction } from "@/features/invoices/actions";
import { sendInvoiceAction } from "@/features/invoices/delivery";
import { createContractAction, updateContractAction } from "@/features/contracts/actions";
import { sendContractAction } from "@/features/contracts/delivery";
import { getContractShareUrl } from "@/features/documents/urls";
import { createClientAction } from "@/features/clients/actions";
import { createProjectAction } from "@/features/projects/actions";
import { manualTimeEntryAction } from "@/features/time/actions";
import { INDIAN_STATES } from "@/features/gst/state-codes";
import { ensureInvoicePublicToken } from "@/features/share/server";
import { buildWaUrl } from "@/lib/whatsapp";
import {
  createWelcomeDocumentAction,
  publishWelcomeDocumentAction,
  updateWelcomeDocumentAction,
} from "@/features/welcome-documents/actions";
import { parseWelcomeContent } from "@/features/welcome-documents/content";
import { sendWelcomeDocumentAction } from "@/features/welcome-documents/delivery";
import {
  ensureWelcomePublicToken,
} from "@/features/welcome-documents/server";
import { getWelcomeShareUrl } from "@/features/welcome-documents/routes";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { generateInvoiceDraftAction, generateOperationalDraftAction } from "./actions";
import { generateStructuredJson } from "./groq";
import { interpretMessage } from "./nlu";
import {
  AI_FIELD_SEQUENCE,
  AI_SKIP_SENTINEL,
  NO_CLIENT_SENTINEL,
  NO_PROJECT_SENTINEL,
  aiInterpretRequestSchema,
  type AiContractDraft,
  type AiFields,
  type AiMissingField,
  type AiWelcomeDraft,
  type AiWorkflow,
} from "./types";

/** A field/value row shown in a pre-create confirmation summary. */
type AiConfirmLine = [label: string, value: string];
interface AiConfirmSummary {
  kind: "client" | "project" | "time_entry";
  title: string;
  lines: AiConfirmLine[];
}

const aiInvoiceIdSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice id"),
});

const aiContractIdSchema = z.object({
  contractId: z.string().uuid("Invalid contract id"),
});

const aiDocsQuestionSchema = z.object({
  question: z.string().trim().min(4).max(3000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional(),
});

async function requireUserId() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

// ---------------------------------------------------------------------------
// Intelligence layer: structured-field inputs + missing-field reporting
// ---------------------------------------------------------------------------

const aiFieldsSchema = z.record(z.string());

const aiCreateSchema = z.object({
  fields: aiFieldsSchema.optional(),
  clientId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  prompt: z.string().max(6000).optional().or(z.literal("")),
  /** Set true once the user has approved the pre-create confirmation summary. */
  confirm: z.boolean().optional(),
});

type AiCreateInput = z.infer<typeof aiCreateSchema>;

/** Read a canonical field, trimmed; treats "skip"/"none" as empty. */
function field(fields: AiFields | undefined, key: string): string {
  return cleanAiAnswer(fields?.[key]);
}

const MISSING_FIELD_QUESTIONS: Record<string, AiMissingField> = {
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
    question: "What amount should I invoice (before tax/discount)?",
    placeholder: "Example: 50000",
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
  },
  question: { field: "question", question: "What do you need help with?" },
  projectId: { field: "projectId", question: "Which project should I link this to? Or choose “No project”." },
  // Contract detail prompts (offered once each, user can reply "skip").
  type: {
    field: "type",
    question: "What kind of document is this — agreement, proposal, NDA, or retainer? Or reply “skip”.",
    placeholder: "Example: Service agreement",
    optional: true,
  },
  commercials: {
    field: "commercials",
    question: "What are the fees and payment terms? Or reply “skip”.",
    placeholder: "Example: ₹150000, 50% upfront, balance on delivery",
    optional: true,
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
  // Welcome-document detail prompts (offered once each, user can reply "skip").
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
  },
  // Client fields — asked one at a time.
  email: {
    field: "email",
    question: "What's their email address?",
    placeholder: "Example: rupal@acme.com",
  },
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
  // Optional prompts (offered once, user can reply "skip").
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
  },
  dueDate: {
    field: "dueDate",
    question: "When is it due? e.g. “in 15 days”, or reply “skip”.",
    placeholder: "Example: in 15 days",
    optional: true,
  },
};

/** Human-readable state name for a GST state code (for confirmation summaries). */
function stateName(code: string): string {
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? "—";
}

/**
 * Returns the next field to ask for, or null when nothing is outstanding.
 * Walks the workflow's ordered field sequence top to bottom and returns the
 * first field still missing — so the assistant collects fields one at a time,
 * in order. Required fields are asked until a real value is given; optional
 * fields are offered once (a real value OR an explicit "skip" counts as
 * addressed, so they're never silently bypassed and never re-asked forever).
 */
function nextMissingField(
  workflow: AiWorkflow,
  fields: AiFields,
  resolved: { clientId?: string; amount?: number; projectId?: string; projectSkipped?: boolean },
): AiMissingField | null {
  for (const spec of AI_FIELD_SEQUENCE[workflow]) {
    const key = spec.field;

    if (key === "clientId") {
      if (!resolved.clientId) return MISSING_FIELD_QUESTIONS.clientId;
      continue;
    }
    if (key === "amount") {
      if (!resolved.amount || resolved.amount <= 0) return MISSING_FIELD_QUESTIONS.amount;
      continue;
    }
    if (key === "projectId") {
      // Project allocation is resolved outside `fields` (via the picker). It is
      // addressed once a project is chosen or explicitly skipped.
      if (!resolved.projectId && !resolved.projectSkipped) {
        return { ...MISSING_FIELD_QUESTIONS.projectId, optional: !!spec.optional };
      }
      continue;
    }

    if (spec.optional) {
      const skipped = fields[key] === AI_SKIP_SENTINEL;
      let satisfied: boolean;
      if (key === "dueDate" && workflow === "project") {
        // Projects can also state a due date inside a combined "dates" phrase —
        // don't re-ask when the user already gave one there.
        satisfied = skipped || !!field(fields, "dueDate") || !!parseProjectDates(field(fields, "dates")).dueDate;
      } else {
        satisfied = skipped || !!field(fields, key);
      }
      if (!satisfied) {
        const q = MISSING_FIELD_QUESTIONS[key] ?? { field: key, question: `Add ${key}? (or reply skip)` };
        return { ...q, optional: true };
      }
      continue;
    }

    // Required text field — ask until a real (non-skip) value is given.
    if (!field(fields, key)) {
      return MISSING_FIELD_QUESTIONS[key] ?? { field: key, question: `Please provide ${key}.` };
    }
  }
  return null;
}

export async function interpretAiMessageAction(input: z.infer<typeof aiInterpretRequestSchema>) {
  const parsed = aiInterpretRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Tell me what you'd like to do." };
  }
  await requireUserId();
  const [clients, projects] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
  ]);
  const result = await interpretMessage({
    message: parsed.data.message,
    currentWorkflow: parsed.data.currentWorkflow,
    collected: parsed.data.collected,
    history: parsed.data.history,
    clients,
    projects,
  });
  return { ok: true as const, data: result };
}

// Currency tokens we recognise before/after an amount. `rup\w*` catches
// "rupee", "rupees", and common misspellings like "ruppess"/"rupaye".
const CURRENCY_TOKEN = String.raw`(?:₹|rs\.?|inr|rupees?|rup\w*|\/-)`;

function amountFromPrompt(prompt: string) {
  // Drop percentage figures (e.g. "50% upfront") first so they're never
  // mistaken for the amount, then strip thousands separators.
  const normalized = prompt.replace(/\d+(?:\.\d+)?\s*%/g, " ").replace(/,/g, "");
  const match =
    normalized.match(new RegExp(`${CURRENCY_TOKEN}\\s*(\\d+(?:\\.\\d+)?)`, "i")) ??
    normalized.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${CURRENCY_TOKEN}`, "i")) ??
    normalized.match(/\b(\d{4,}(?:\.\d+)?)\b/);
  return match ? Number(match[1]) : 0;
}

function quantityFromPrompt(prompt: string) {
  const normalized = prompt.replace(/,/g, "").toLowerCase();
  const match =
    normalized.match(/\bqty(?:uantity)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\b/) ??
    normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:x|units?|items?)\b/);
  const value = match ? Number(match[1]) : 1;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function quantityFromAnswer(value: string) {
  const cleaned = cleanAiAnswer(value);
  if (!cleaned) return 1;
  const explicit = quantityFromPrompt(cleaned);
  if (explicit !== 1 || /\b1\b/.test(cleaned)) return explicit;
  const number = cleaned.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  const parsed = number ? Number(number) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function discountFromPrompt(prompt: string, subtotal: number) {
  const normalized = prompt.replace(/,/g, "").toLowerCase();
  const percentMatch =
    normalized.match(/(?:discount|off)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*%/) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*%\s*(?:discount|off)/);
  if (percentMatch) {
    return Math.min(subtotal, Math.max(0, (subtotal * Number(percentMatch[1])) / 100));
  }

  const flatMatch =
    normalized.match(
      new RegExp(`(?:discount|off)\\s*(?:of\\s*)?${CURRENCY_TOKEN}?\\s*(\\d+(?:\\.\\d+)?)`, "i"),
    ) ??
    normalized.match(
      new RegExp(`${CURRENCY_TOKEN}?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:discount|off)`, "i"),
    );
  return flatMatch ? Math.min(subtotal, Math.max(0, Number(flatMatch[1]))) : 0;
}

function discountFromAnswer(value: string, subtotal: number) {
  const cleaned = cleanAiAnswer(value);
  if (!cleaned) return 0;
  const parsed = discountFromPrompt(cleaned, subtotal);
  if (parsed > 0) return parsed;
  const number = cleaned.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  return number ? Math.min(subtotal, Math.max(0, Number(number))) : 0;
}

function dueDateFromPrompt(prompt: string, fallbackDays: number) {
  const date = new Date();
  const lower = prompt.toLowerCase();
  // The NLU normalizes dates to ISO — trust an ISO date directly.
  const isoMatch = prompt.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];
  const daysMatch = lower.match(/\b(\d{1,3})\s*days?\b/);
  const weeksMatch = lower.match(/\b(\d{1,3})\s*weeks?\b/);
  const monthsMatch = lower.match(/\b(\d{1,3})\s*months?\b/);
  if (daysMatch) {
    date.setDate(date.getDate() + Number(daysMatch[1]));
    return date.toISOString().slice(0, 10);
  }
  if (weeksMatch) {
    date.setDate(date.getDate() + Number(weeksMatch[1]) * 7);
    return date.toISOString().slice(0, 10);
  }
  if (monthsMatch) {
    date.setMonth(date.getMonth() + Number(monthsMatch[1]));
    return date.toISOString().slice(0, 10);
  }
  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }
  if (lower.includes("next week")) {
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }
  if (lower.includes("next month")) {
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().slice(0, 10);
  }
  if (lower.includes("month end") || lower.includes("end of month")) {
    date.setMonth(date.getMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
  }
  date.setDate(date.getDate() + fallbackDays);
  return date.toISOString().slice(0, 10);
}

function cleanPromptTitle(prompt: string, fallback: string) {
  return (
    prompt
      .split(/[.\n]/)
      .map((part) => part.trim())
      .find(Boolean) ?? fallback
  ).slice(0, 180);
}

function cleanAiAnswer(value: string | undefined | null) {
  const cleaned = (value ?? "").trim();
  if (!cleaned) return "";
  if (cleaned === AI_SKIP_SENTINEL) return "";
  if (/^(skip|none|no|n\/a|na|nope|nah|leave it|not now|-|—)$/i.test(cleaned)) return "";
  return cleaned;
}

function extractEmail(value: string) {
  return value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
}

function extractPhone(value: string) {
  const withoutEmail = value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ");
  const match = withoutEmail.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match ? match[0].replace(/[^\d+]/g, "") : "";
}

function stateCodeFromText(value: string, fallback: string) {
  const normalized = value.toLowerCase();
  const state = INDIAN_STATES.find((item) => {
    const name = item.name.toLowerCase();
    return (
      normalized.includes(name) ||
      new RegExp(`\\b${item.isoAlpha.toLowerCase()}\\b`).test(normalized)
    );
  });
  if (state) return state.code;

  const cityMap: Record<string, string> = {
    indore: "23",
    bhopal: "23",
    mumbai: "27",
    pune: "27",
    delhi: "07",
    bengaluru: "29",
    bangalore: "29",
    hyderabad: "36",
    chennai: "33",
    ahmedabad: "24",
    jaipur: "08",
    lucknow: "09",
    kolkata: "19",
  };
  const city = Object.entries(cityMap).find(([name]) => normalized.includes(name));
  return city?.[1] ?? fallback;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function nextWeekday(from: Date, weekday: number) {
  const date = new Date(from);
  const delta = (weekday + 7 - date.getDay()) % 7 || 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function parseProjectDates(value: string) {
  const lower = value.toLowerCase();
  const todayDate = new Date();
  const isoMatches = value.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];
  if (isoMatches.length >= 2) {
    return { startDate: isoMatches[0] ?? "", dueDate: isoMatches[1] ?? "" };
  }

  let startDate = isoMatches[0] && !/(due|deadline|end|complete)/i.test(value) ? isoMatches[0] : "";
  let dueDate = isoMatches[0] && !startDate ? isoMatches[0] : "";

  const slashMatches = value.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g) ?? [];
  const parsedSlash = slashMatches
    .map((item) => {
      const [day, month, rawYear] = item.split(/[/-]/).map(Number);
      const year = rawYear && rawYear < 100 ? 2000 + rawYear : rawYear;
      if (!day || !month || !year) return "";
      return isoDate(new Date(year, month - 1, day));
    })
    .filter(Boolean);
  if (parsedSlash.length >= 2) {
    return { startDate: parsedSlash[0] ?? "", dueDate: parsedSlash[1] ?? "" };
  }
  if (parsedSlash[0]) {
    if (/(due|deadline|end|complete)/i.test(value)) dueDate = parsedSlash[0];
    else startDate = parsedSlash[0];
  }

  if (!startDate) {
    if (lower.includes("start today") || lower.includes("starts today")) startDate = isoDate(todayDate);
    else if (lower.includes("start tomorrow") || lower.includes("starts tomorrow")) startDate = isoDate(addDays(todayDate, 1));
    else if (lower.includes("start next week") || lower.includes("starts next week")) startDate = isoDate(addDays(todayDate, 7));
    else if (lower.includes("next monday")) startDate = isoDate(nextWeekday(todayDate, 1));
  }

  if (!dueDate) {
    const lead = "(?:due|deadline|complete|finish|ends?|in)\\s*(?:in\\s*)?";
    const dueDays = lower.match(new RegExp(`${lead}(\\d{1,3})\\s*days?`));
    const dueWeeks = lower.match(new RegExp(`${lead}(\\d{1,3})\\s*weeks?`));
    const dueMonths = lower.match(new RegExp(`${lead}(\\d{1,3})\\s*months?`));
    if (dueDays) dueDate = isoDate(addDays(todayDate, Number(dueDays[1])));
    else if (dueWeeks) dueDate = isoDate(addDays(todayDate, Number(dueWeeks[1]) * 7));
    else if (dueMonths) dueDate = isoDate(addMonths(todayDate, Number(dueMonths[1])));
    else if (lower.includes("due next week") || lower.includes("deadline next week") || lower.includes("next week")) dueDate = isoDate(addDays(todayDate, 7));
    else if (lower.includes("due end of month") || lower.includes("end of month")) dueDate = isoDate(endOfMonth(todayDate));
    else if (lower.includes("due next month") || lower.includes("next month")) dueDate = isoDate(endOfMonth(addMonths(todayDate, 1)));
    else if (lower.includes("tomorrow")) dueDate = isoDate(addDays(todayDate, 1));
  }

  return { startDate, dueDate };
}

function projectStatusFromText(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("active") || lower.includes("started") || lower.includes("in progress")) return "active";
  if (lower.includes("waiting")) return "waiting_on_client";
  if (lower.includes("review")) return "review";
  if (lower.includes("hold") || lower.includes("paused")) return "on_hold";
  if (lower.includes("lead")) return "lead";
  if (lower.includes("completed") || lower.includes("done")) return "completed";
  return "planning";
}

function contractKindFromText(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("proposal")) return "proposal" as const;
  return "contract" as const;
}

function contractTitleFromDraft(kind: "contract" | "proposal", clientName: string, projectName: string, fallback: string) {
  const subject = projectName || clientName;
  if (subject) return `${subject} ${kind === "proposal" ? "Proposal" : "Agreement"}`;
  return cleanPromptTitle(fallback, kind === "proposal" ? "Project proposal" : "Service agreement");
}

/** Parse an amount from a structured field value (handles "₹50000", "50000", "5k"). */
function amountFromField(value: string) {
  const cleaned = cleanAiAnswer(value);
  if (!cleaned) return 0;
  const viaPrompt = amountFromPrompt(cleaned);
  if (viaPrompt > 0) return viaPrompt;
  // Fallback: also ignore percentage figures so "50% upfront" never wins.
  const number = cleaned
    .replace(/\d+(?:\.\d+)?\s*%/g, " ")
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/)?.[0];
  const parsed = number ? Number(number) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Parse a duration string like "2h 30m", "2.5 hours", "90 minutes", "45m" into seconds. */
function durationSecondsFromText(value: string) {
  const cleaned = cleanAiAnswer(value).toLowerCase();
  if (!cleaned) return 0;

  let seconds = 0;
  const hoursMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const minutesMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  if (hoursMatch) seconds += Math.round(Number(hoursMatch[1]) * 3600);
  if (minutesMatch) seconds += Math.round(Number(minutesMatch[1]) * 60);
  if (seconds > 0) return seconds;

  // "2:30" => 2h 30m
  const colon = cleaned.match(/\b(\d{1,2}):(\d{2})\b/);
  if (colon) return Number(colon[1]) * 3600 + Number(colon[2]) * 60;

  // Bare number — treat as hours when small, else minutes.
  const bare = cleaned.match(/\d+(?:\.\d+)?/)?.[0];
  if (bare) {
    const num = Number(bare);
    if (num > 0 && num <= 12) return Math.round(num * 3600);
    if (num > 12) return Math.round(num * 60);
  }
  return 0;
}

function billableFromText(value: string) {
  const cleaned = cleanAiAnswer(value).toLowerCase();
  if (/\bnon[-\s]?billable\b|not billable|unbillable|free|no charge/.test(cleaned)) return false;
  return true;
}

/** Build a clean free-text brief for Groq drafting from labelled structured fields. */
function briefFromFields(entries: Array<[string, string]>, fallback: string) {
  const lines = entries
    .map(([label, value]) => {
      const cleaned = cleanAiAnswer(value);
      return cleaned ? `${label}: ${cleaned}` : "";
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n\n") : fallback;
}

export async function createClientFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me about the client first." };
  const fields = parsed.data.fields ?? {};

  const fullName = field(fields, "fullName");
  const missing = nextMissingField("client", fields, {});
  if (missing) {
    return { ok: false as const, error: missing.question, missing };
  }

  const profile = await getProfile();
  const fallbackStateCode = profile?.stateCode ?? "27";

  const businessName = field(fields, "businessName");
  const billingAddress = field(fields, "billingAddress");
  const notes = field(fields, "notes");
  // Each contact detail is now collected in its own prompt, so pull it from its
  // own field first (with the original prompt as a fallback for one-shot input).
  const email = extractEmail([field(fields, "email"), parsed.data.prompt ?? ""].join(" "));
  const phone = extractPhone([field(fields, "phone"), parsed.data.prompt ?? ""].join(" "));
  // State is an explicit, required question now. Use the user's answer, fall back
  // to a state named in the billing address, and only then the profile default.
  const detectedState =
    stateCodeFromText(field(fields, "state"), "") || stateCodeFromText(billingAddress, "");
  const stateCode = detectedState || fallbackStateCode;

  // Confirmation gate — show what will be created and wait for approval.
  if (!parsed.data.confirm) {
    return {
      ok: false as const,
      needsConfirm: true as const,
      error: "Confirm the client details to create it.",
      summary: {
        kind: "client" as const,
        title: "Create this client?",
        lines: [
          ["Name", fullName],
          ["Email", email || "—"],
          ["Phone", phone || "—"],
          ["Billing address", billingAddress || "—"],
          ["State", detectedState ? stateName(stateCode) : `${stateName(stateCode)} (default)`],
          ["Notes", notes || "—"],
        ],
      } satisfies AiConfirmSummary,
    };
  }

  const fd = new FormData();
  fd.set("gstRegistered", "false");
  fd.set("fullName", fullName);
  fd.set("businessName", businessName);
  fd.set("email", email);
  fd.set("phone", phone);
  fd.set("stateCode", stateCode);
  fd.set("billingAddress", billingAddress);
  fd.set("notes", notes);
  fd.set("gstin", "");

  const res = await createClientAction(undefined, fd);
  if (!res.ok) return { ok: false as const, error: res.error };
  return {
    ok: true as const,
    data: { id: res.data?.id ?? "", fullName, businessName, email, phone },
    message: res.message,
  };
}

export async function createProjectFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me about the project first." };
  const fields = parsed.data.fields ?? {};

  // "__none__" is the explicit "internal project, no client" choice from the picker.
  const rawClientId = parsed.data.clientId || "";
  const clientSkipped = rawClientId === NO_CLIENT_SENTINEL;
  const clientId = clientSkipped ? "" : rawClientId;

  const name = field(fields, "name");
  const missing = nextMissingField("project", fields, {
    clientId: clientSkipped ? NO_CLIENT_SENTINEL : clientId,
  });
  if (missing) {
    return { ok: false as const, error: missing.question, missing };
  }

  const scope = field(fields, "scope");
  const status = projectStatusFromText(field(fields, "status") || "planning");
  const baseDates = parseProjectDates(field(fields, "dates"));
  // Default the start date to today (the created date) when none was given.
  const startDate = baseDates.startDate || isoDate(new Date());
  // Prefer an explicit answer to the due-date prompt. We phrase it as "due …"
  // so a bare reply like "in 15 days" or "end of month" parses as a due date.
  const dueAnswer = field(fields, "dueDate");
  const dueDate = dueAnswer
    ? parseProjectDates(`due ${dueAnswer}`).dueDate || baseDates.dueDate
    : baseDates.dueDate;

  // Confirmation gate.
  if (!parsed.data.confirm) {
    let clientLabel = "Internal — no client";
    if (clientId) {
      const userId = await requireUserId();
      const supabase = await getServerSupabase();
      const { data: clientRow } = await supabase
        .from("clients")
        .select("full_name, business_name")
        .eq("id", clientId)
        .eq("user_id", userId)
        .maybeSingle();
      const c = clientRow as { full_name?: string | null; business_name?: string | null } | null;
      clientLabel = c?.business_name || c?.full_name || "Selected client";
    }
    return {
      ok: false as const,
      needsConfirm: true as const,
      error: "Confirm the project details to create it.",
      summary: {
        kind: "project" as const,
        title: "Create this project?",
        lines: [
          ["Name", name],
          ["Client", clientLabel],
          ["Scope", scope || "—"],
          ["Start date", startDate],
          ["Due date", dueDate || "Not set"],
        ],
      } satisfies AiConfirmSummary,
    };
  }

  const fd = new FormData();
  fd.set("name", name);
  fd.set("description", scope);
  fd.set("clientId", clientId);
  fd.set("status", status);
  fd.set("startDate", startDate);
  fd.set("dueDate", dueDate);

  const res = await createProjectAction(undefined, fd);
  if (!res.ok) return { ok: false as const, error: res.error };
  return {
    ok: true as const,
    data: { id: res.data?.id ?? "", name, description: scope },
    message: res.message,
  };
}

export async function createTimeEntryFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me what work to log." };
  const fields = parsed.data.fields ?? {};

  const description = field(fields, "description");
  const durationSeconds = durationSecondsFromText(field(fields, "duration"));

  if (!description) {
    return {
      ok: false as const,
      error: MISSING_FIELD_QUESTIONS.description.question,
      missing: MISSING_FIELD_QUESTIONS.description,
    };
  }
  if (durationSeconds <= 0) {
    return {
      ok: false as const,
      error: MISSING_FIELD_QUESTIONS.duration.question,
      missing: MISSING_FIELD_QUESTIONS.duration,
    };
  }

  // Project allocation — always ask which project to log against (with an
  // explicit "no project / internal" option) so time is never logged without
  // a deliberate choice.
  const rawProjectId = parsed.data.projectId || "";
  const projectSkipped = rawProjectId === NO_PROJECT_SENTINEL;
  const projectId = projectSkipped ? "" : rawProjectId;
  if (!projectId && !projectSkipped) {
    return {
      ok: false as const,
      error: MISSING_FIELD_QUESTIONS.projectId.question,
      missing: MISSING_FIELD_QUESTIONS.projectId,
    };
  }

  const billable = billableFromText(field(fields, "billable") || field(fields, "duration"));
  const hourlyRate = billable ? amountFromField(field(fields, "rate") || field(fields, "hourlyRate")) : 0;

  // Resolve the project name for the confirmation summary.
  let projectName = "No project (internal)";
  if (projectId) {
    const userId = await requireUserId();
    const supabase = await getServerSupabase();
    const { data: projectRow } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .eq("user_id", userId)
      .maybeSingle();
    projectName = (projectRow as { name?: string | null } | null)?.name || "Selected project";
  }

  // Confirmation gate.
  if (!parsed.data.confirm) {
    const h = Math.floor(durationSeconds / 3600);
    const m = Math.round((durationSeconds % 3600) / 60);
    return {
      ok: false as const,
      needsConfirm: true as const,
      error: "Confirm the time entry to log it.",
      summary: {
        kind: "time_entry" as const,
        title: "Log this time entry?",
        lines: [
          ["Work", description],
          ["Project", projectName],
          ["Duration", `${h}h ${m}m`],
          ["Billing", billable ? "Billable" : "Non-billable"],
        ],
      } satisfies AiConfirmSummary,
    };
  }

  const fd = new FormData();
  fd.set("description", description);
  fd.set("projectId", projectId);
  fd.set("startedAt", new Date().toISOString());
  fd.set("durationSeconds", String(durationSeconds));
  fd.set("billable", billable ? "true" : "false");
  fd.set("hourlyRate", String(hourlyRate));

  const res = await manualTimeEntryAction(undefined, fd);
  if (!res.ok) return { ok: false as const, error: res.error };

  const hours = Math.floor(durationSeconds / 3600);
  const minutes = Math.round((durationSeconds % 3600) / 60);
  return {
    ok: true as const,
    data: {
      id: res.data?.id ?? "",
      description,
      hours,
      minutes,
      billable,
      hourlyRate,
    },
    message: res.message ?? "Time entry logged.",
  };
}

export async function createInvoiceFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Tell me about the invoice first." };
  }
  const fields = parsed.data.fields ?? {};

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const profile = await getProfile();

  const clientId = parsed.data.clientId || "";
  // Project allocation — "__no_project__" means the user chose no project.
  const rawProjectId = parsed.data.projectId || "";
  const projectSkipped = rawProjectId === NO_PROJECT_SENTINEL;
  const projectId = projectSkipped ? "" : rawProjectId;
  const fallbackDueDays = profile?.invoiceDefaultDueDays ?? 15;
  const originalSubtotal = amountFromField(field(fields, "amount"));

  const missing = nextMissingField("invoice", fields, {
    clientId,
    amount: originalSubtotal,
    projectId,
    projectSkipped,
  });
  if (missing) {
    return { ok: false as const, error: missing.question, missing };
  }

  const nextNumber = await nextInvoiceNumber(userId);
  const workDescription = field(fields, "workDescription") || "Professional services";
  const quantity = field(fields, "quantity") ? quantityFromAnswer(field(fields, "quantity")) : 1;
  const discount = field(fields, "discount")
    ? discountFromAnswer(field(fields, "discount"), originalSubtotal)
    : 0;
  const dueDate = dueDateFromPrompt(field(fields, "dueDate"), fallbackDueDays);
  const invoiceInput = {
    workDescription,
    originalSubtotal,
    quantity,
    discount,
    dueDate,
    terms: "",
    notes: field(fields, "notes"),
  };

  const netSubtotal = Math.max(0, originalSubtotal - discount);
  const unitPrice = quantity > 0 ? originalSubtotal / quantity : originalSubtotal;
  const draftFd = new FormData();
  draftFd.set(
    "payload",
    JSON.stringify({
      clientId,
      projectId,
      workDescription: invoiceInput.workDescription,
      amount: netSubtotal,
      quantity,
      dueDate,
      notes: invoiceInput.notes,
    }),
  );
  const draftResult = await generateInvoiceDraftAction(draftFd);
  if (!draftResult.ok) return draftResult;
  const line = draftResult.data.items[0];

  const fd = new FormData();
  fd.set(
    "payload",
    JSON.stringify({
      clientId,
      projectId: projectId || undefined,
      invoiceNumber: nextNumber.formatted,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate,
      currency: profile?.defaultCurrency ?? "INR",
      status: "draft",
      discount,
      notes: invoiceInput.notes || draftResult.data.notes || undefined,
      terms: invoiceInput.terms || draftResult.data.terms || profile?.invoiceDefaultTerms || undefined,
      lines: [
        {
          description: line?.description || cleanPromptTitle(invoiceInput.workDescription, "Professional services"),
          quantity,
          unitPrice,
          gstRate: profile?.gstRegistered ? profile.invoiceDefaultGstRate : 0,
          position: 0,
        },
      ],
    }),
  );

  const res = await createInvoiceAction(undefined, fd);
  if (!res.ok) return res;
  if (!res.data?.id) return { ok: false as const, error: "Invoice was saved but its id was not returned." };
  const invoiceId = res.data.id;

  const [{ data: invoiceRow }, { data: clientRow }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, currency, subtotal, discount_amount, gst_amount, total_amount, due_date, status, notes, terms")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("full_name, business_name, email, phone")
      .eq("id", clientId)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const invoice = invoiceRow as
    | {
        id: string;
        invoice_number: string;
        currency: string;
        subtotal: number;
        discount_amount: number;
        gst_amount: number;
        total_amount: number;
        due_date: string;
        status: string;
        notes?: string | null;
        terms?: string | null;
      }
    | null;
  const client = clientRow as
    | {
        full_name?: string | null;
        business_name?: string | null;
        email?: string | null;
        phone?: string | null;
      }
    | null;

  return {
    ok: true as const,
    data: {
      ...res.data,
      invoiceNumber: invoice?.invoice_number ?? nextNumber.formatted,
      draft: draftResult.data,
      preview: {
        id: invoiceId,
        invoiceNumber: invoice?.invoice_number ?? nextNumber.formatted,
        clientName: client?.business_name || client?.full_name || "Selected client",
        clientEmail: client?.email ?? null,
        clientPhone: client?.phone ?? null,
        description: line?.description || cleanPromptTitle(invoiceInput.workDescription, "Professional services"),
        quantity,
        unitPrice,
        originalSubtotal,
        discount: Number(invoice?.discount_amount ?? discount),
        subtotal: Number(invoice?.subtotal ?? netSubtotal),
        taxTotal: Number(invoice?.gst_amount ?? 0),
        totalAmount: Number(invoice?.total_amount ?? netSubtotal),
        currency: invoice?.currency ?? profile?.defaultCurrency ?? "INR",
        dueDate: invoice?.due_date ?? dueDate,
        status: invoice?.status ?? "draft",
        terms: invoice?.terms ?? draftResult.data.terms ?? profile?.invoiceDefaultTerms ?? null,
        notes: invoice?.notes ?? draftResult.data.notes ?? null,
      },
    },
    message: "Invoice draft created.",
  };
}

export async function approveInvoiceFromAiAction(input: z.infer<typeof aiInvoiceIdSchema>) {
  const parsed = aiInvoiceIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice." };

  const fd = new FormData();
  fd.set("id", parsed.data.invoiceId);
  fd.set("status", "sent");
  const res = await setInvoiceStatusAction(undefined, fd);
  if (!res.ok) return res;
  return { ok: true as const, message: "Invoice approved and marked as sent." };
}

export async function emailInvoiceFromAiAction(input: z.infer<typeof aiInvoiceIdSchema>) {
  const parsed = aiInvoiceIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice." };
  return sendInvoiceAction({ invoiceId: parsed.data.invoiceId });
}

export async function invoiceWhatsappFromAiAction(input: z.infer<typeof aiInvoiceIdSchema>) {
  const parsed = aiInvoiceIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid invoice." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { data: invoiceRow } = await supabase
    .from("invoices")
    .select("id, user_id, client_id, invoice_number, currency, total_amount")
    .eq("id", parsed.data.invoiceId)
    .eq("user_id", userId)
    .maybeSingle();
  const invoice = invoiceRow as
    | {
        id: string;
        user_id: string;
        client_id?: string | null;
        invoice_number: string;
        currency: string;
        total_amount: number;
      }
    | null;
  if (!invoice) return { ok: false as const, error: "Invoice not found." };

  const [{ data: clientRow }, { data: profileRow }] = await Promise.all([
    invoice.client_id
      ? supabase
          .from("clients")
          .select("full_name, business_name, phone")
          .eq("id", invoice.client_id)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("user_profiles")
      .select("business_name, legal_name, full_name, display_name")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  const client = clientRow as
    | { full_name?: string | null; business_name?: string | null; phone?: string | null }
    | null;
  const profile = profileRow as
    | {
        business_name?: string | null;
        legal_name?: string | null;
        full_name?: string | null;
        display_name?: string | null;
      }
    | null;
  const token = await ensureInvoicePublicToken(invoice.id);
  if (!token) return { ok: false as const, error: "Could not create invoice share link." };

  const fd = new FormData();
  fd.set("invoiceId", invoice.id);
  fd.set("status", "sent");
  await setInvoiceStatusAction(undefined, fd);

  const shareUrl = `${env.appUrl.replace(/\/$/, "")}/i/${token}`;
  const senderName =
    profile?.business_name || profile?.legal_name || profile?.display_name || profile?.full_name || "Stackivo";

  return {
    ok: true as const,
    data: {
      url: buildWaUrl({
        phone: client?.phone ?? null,
        clientName: client?.business_name || client?.full_name || null,
        documentType: "invoice",
        documentNumber: invoice.invoice_number,
        amount: Number(invoice.total_amount) || 0,
        currency: invoice.currency,
        senderName,
        shareUrl,
      }),
    },
  };
}

export async function createContractFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Tell me about the contract first." };
  }
  const fields = parsed.data.fields ?? {};
  const clientId = parsed.data.clientId || "";

  // Project allocation — "__no_project__" means the user chose no project.
  const rawProjectId = parsed.data.projectId || "";
  const projectSkipped = rawProjectId === NO_PROJECT_SENTINEL;
  const projectId = projectSkipped ? "" : rawProjectId;

  const missing = nextMissingField("contract", fields, { clientId, projectId, projectSkipped });
  if (missing) {
    return { ok: false as const, error: missing.question, missing };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const [{ data: clientRow }, { data: projectRow }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, business_name, email")
      .eq("id", clientId)
      .eq("user_id", userId)
      .maybeSingle(),
    projectId
      ? supabase
          .from("projects")
          .select("id, name")
          .eq("id", projectId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const client = clientRow as
    | { id: string; full_name?: string | null; business_name?: string | null; email?: string | null }
    | null;
  if (!client) return { ok: false as const, error: "Choose a client you have access to." };
  const project = projectRow as { id: string; name?: string | null } | null;

  const scope = field(fields, "scope");
  const type = field(fields, "type");
  const commercials = field(fields, "commercials");
  const timeline = field(fields, "timeline");
  const clauses = field(fields, "clauses");
  const amount = amountFromField(field(fields, "amount") || commercials);
  const brief = briefFromFields(
    [
      ["Document type", type],
      ["Client", client.business_name || client.full_name || ""],
      ["Project", project?.name || ""],
      ["Scope and deliverables", scope],
      ["Timeline and milestones", timeline],
      ["Commercials, payment, revisions, and IP", commercials],
      ["Special clauses, exclusions, and responsibilities", clauses],
      ["Contract value", amount > 0 ? String(amount) : ""],
    ],
    scope,
  );

  const fdDraft = new FormData();
  fdDraft.set(
    "payload",
    JSON.stringify({
      workflow: "contract",
      prompt: brief,
      clientId,
      projectId,
    }),
  );
  const draftResult = await generateOperationalDraftAction(fdDraft);
  if (!draftResult.ok || !("sections" in draftResult.data)) {
    return { ok: false as const, error: draftResult.ok ? "Could not draft contract." : draftResult.error };
  }

  const draft = draftResult.data as AiContractDraft;
  const kind = contractKindFromText(type || draft.kind);
  const title =
    cleanAiAnswer(draft.title) ||
    contractTitleFromDraft(
      kind,
      client.business_name || client.full_name || "",
      project?.name || "",
      scope,
    );
  const sections = draft.sections.length > 0
    ? draft.sections
    : [
        { heading: "Scope of Work", body: scope || "The service provider will deliver the agreed services." },
        { heading: "Fees and Payment", body: commercials || "Fees and payment terms will follow the agreed commercial terms." },
        { heading: "Responsibilities", body: clauses || "Both parties will cooperate in good faith to complete the engagement." },
      ];

  const fd = new FormData();
  fd.set("kind", kind);
  fd.set("title", title);
  fd.set("content", JSON.stringify(sections));
  fd.set("clientId", clientId);
  if (projectId) fd.set("projectId", projectId);
  fd.set("status", "draft");
  fd.set("currency", "INR");
  if (amount > 0) fd.set("valueAmount", String(amount));

  const res = await createContractAction(undefined, fd);
  if (!res.ok) return res;
  if (!res.data?.id) return { ok: false as const, error: "Contract was saved but its id was not returned." };

  return {
    ok: true as const,
    data: {
      id: res.data.id,
      title,
      kind,
      clientName: client.business_name || client.full_name || "Selected client",
      clientEmail: client.email ?? null,
      projectName: project?.name ?? null,
      valueAmount: amount > 0 ? amount : draft.valueAmount ?? null,
      currency: "INR",
      sections,
    },
    message: "Contract draft created.",
  };
}

export async function sendContractFromAiAction(input: z.infer<typeof aiContractIdSchema>) {
  const parsed = aiContractIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid contract." };
  return sendContractAction({ contractId: parsed.data.contractId });
}

const aiContractRefineSchema = z.object({
  contractId: z.string().uuid("Invalid contract id"),
  instruction: z.string().trim().min(2).max(2000),
});

/**
 * Revise an existing AI-drafted contract in place from a natural-language
 * instruction (e.g. "change the fee to 90000", "add a confidentiality clause").
 * Keeps the same client/project/value and re-renders the full preview so the
 * user can keep refining before they approve & send.
 */
export async function refineContractFromAiAction(
  input: z.infer<typeof aiContractRefineSchema>,
) {
  const parsed = aiContractRefineSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me what to change in the contract." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: contractRow } = await supabase
    .from("contracts")
    .select("id, kind, title, content, client_id, project_id, value_amount, currency")
    .eq("id", parsed.data.contractId)
    .eq("user_id", userId)
    .maybeSingle();
  const contract = contractRow as
    | {
        id: string;
        kind: string;
        title: string;
        content: string | null;
        client_id?: string | null;
        project_id?: string | null;
        value_amount?: number | null;
        currency?: string | null;
      }
    | null;
  if (!contract) return { ok: false as const, error: "Contract not found." };

  let existingSections: Array<{ heading: string; body: string }> = [];
  try {
    const parsedContent = contract.content ? JSON.parse(contract.content) : [];
    if (Array.isArray(parsedContent)) {
      existingSections = parsedContent.filter(
        (s): s is { heading: string; body: string } =>
          s && typeof s.heading === "string" && typeof s.body === "string",
      );
    }
  } catch {
    /* ignore malformed content */
  }

  const currentText = existingSections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
  const brief = [
    "Revise the EXISTING agreement below by applying the requested change.",
    "Keep every unchanged section intact; only modify what the change requires.",
    "",
    "CURRENT DRAFT:",
    currentText || "(empty draft)",
    "",
    `REQUESTED CHANGE: ${parsed.data.instruction}`,
  ].join("\n");

  const fdDraft = new FormData();
  fdDraft.set(
    "payload",
    JSON.stringify({
      workflow: "contract",
      prompt: brief,
      clientId: contract.client_id ?? "",
      projectId: contract.project_id ?? "",
    }),
  );
  const draftResult = await generateOperationalDraftAction(fdDraft);
  if (!draftResult.ok || !("sections" in draftResult.data)) {
    return {
      ok: false as const,
      error: draftResult.ok ? "Could not revise the contract." : draftResult.error,
    };
  }

  const draft = draftResult.data as AiContractDraft;
  const sections = draft.sections.length > 0 ? draft.sections : existingSections;
  const kind = contract.kind === "proposal" ? ("proposal" as const) : ("contract" as const);
  const title = cleanAiAnswer(draft.title) || contract.title;
  const amount =
    draft.valueAmount ?? (contract.value_amount ? Number(contract.value_amount) : null);
  const currency = contract.currency || "INR";

  const fd = new FormData();
  fd.set("id", contract.id);
  fd.set("kind", kind);
  fd.set("title", title);
  fd.set("content", JSON.stringify(sections));
  if (contract.client_id) fd.set("clientId", contract.client_id);
  if (contract.project_id) fd.set("projectId", contract.project_id);
  fd.set("status", "draft");
  fd.set("currency", currency);
  if (amount && amount > 0) fd.set("valueAmount", String(amount));

  const res = await updateContractAction(undefined, fd);
  if (!res.ok) return { ok: false as const, error: res.error };

  const { data: clientRow } = contract.client_id
    ? await supabase
        .from("clients")
        .select("full_name, business_name, email")
        .eq("id", contract.client_id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const client = clientRow as
    | { full_name?: string | null; business_name?: string | null; email?: string | null }
    | null;

  let projectName: string | null = null;
  if (contract.project_id) {
    const { data: projectRow } = await supabase
      .from("projects")
      .select("name")
      .eq("id", contract.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    projectName = (projectRow as { name?: string | null } | null)?.name ?? null;
  }

  return {
    ok: true as const,
    data: {
      id: contract.id,
      title,
      kind,
      clientName: client?.business_name || client?.full_name || "Selected client",
      clientEmail: client?.email ?? null,
      projectName,
      valueAmount: amount && amount > 0 ? amount : null,
      currency,
      sections,
    },
    message: "Contract updated.",
  };
}

const aiInvoiceRefineSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice id"),
  instruction: z.string().trim().min(2).max(2000),
});

/**
 * Refine an existing AI-drafted invoice from a natural-language instruction
 * ("set amount to 60000", "add 10% discount", "due next month", "rename work to
 * logo design"). The NLU normalises the instruction into fields; we apply them
 * to the (single-line) draft and let updateInvoiceAction recompute GST/totals.
 */
export async function refineInvoiceFromAiAction(
  input: z.infer<typeof aiInvoiceRefineSchema>,
) {
  const parsed = aiInvoiceRefineSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me what to change in the invoice." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const profile = await getProfile();

  const loaded = await getInvoice(parsed.data.invoiceId);
  if (!loaded) return { ok: false as const, error: "Invoice not found." };
  const { invoice, items } = loaded;
  if (items.length !== 1) {
    return {
      ok: false as const,
      error: "This invoice has multiple line items — open it to edit those directly.",
    };
  }
  const line = items[0];

  const [clients, projects] = await Promise.all([
    listClients({ limit: 200 }),
    listProjects({ limit: 200 }),
  ]);
  const nlu = await interpretMessage({
    message: parsed.data.instruction,
    currentWorkflow: "invoice",
    clients,
    projects,
  });
  const f = nlu.fields;

  const changeKeys = ["amount", "discount", "dueDate", "notes", "workDescription", "quantity"];
  if (!changeKeys.some((k) => cleanAiAnswer(f[k]))) {
    return {
      ok: false as const,
      error:
        "I couldn't tell what to change. Try e.g. “set amount to 60000”, “add 10% discount”, “due next month”, or “rename work to logo design”.",
    };
  }

  const description = cleanAiAnswer(f.workDescription) || line.description;
  const quantity = f.quantity ? quantityFromAnswer(f.quantity) : line.quantity || 1;
  const originalSubtotal = f.amount ? amountFromField(f.amount) : line.unitPrice * line.quantity;
  const discount = f.discount
    ? discountFromAnswer(f.discount, originalSubtotal)
    : Number(invoice.discount ?? 0);
  const dueDate = f.dueDate
    ? dueDateFromPrompt(f.dueDate, profile?.invoiceDefaultDueDays ?? 15)
    : invoice.dueDate;
  const notes = cleanAiAnswer(f.notes) || invoice.notes || "";
  const unitPrice = quantity > 0 ? originalSubtotal / quantity : originalSubtotal;

  const fd = new FormData();
  fd.set("id", invoice.id);
  fd.set(
    "payload",
    JSON.stringify({
      clientId: invoice.clientId ?? "",
      projectId: invoice.projectId ?? undefined,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate,
      currency: invoice.currency,
      status: invoice.status,
      discount,
      notes: notes || undefined,
      terms: invoice.terms || undefined,
      lines: [{ description, quantity, unitPrice, gstRate: line.gstRate, position: 0 }],
    }),
  );

  const res = await updateInvoiceAction(undefined, fd);
  if (!res.ok) return { ok: false as const, error: res.error };

  const [{ data: invoiceRow }, { data: clientRow }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, currency, subtotal, discount_amount, gst_amount, total_amount, due_date, status, notes, terms")
      .eq("id", invoice.id)
      .eq("user_id", userId)
      .maybeSingle(),
    invoice.clientId
      ? supabase
          .from("clients")
          .select("full_name, business_name, email, phone")
          .eq("id", invoice.clientId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const row = invoiceRow as
    | {
        invoice_number?: string;
        currency?: string;
        subtotal?: number;
        discount_amount?: number;
        gst_amount?: number;
        total_amount?: number;
        due_date?: string;
        status?: string;
        notes?: string | null;
        terms?: string | null;
      }
    | null;
  const client = clientRow as
    | { full_name?: string | null; business_name?: string | null; email?: string | null; phone?: string | null }
    | null;

  const netSubtotal = Math.max(0, originalSubtotal - discount);
  return {
    ok: true as const,
    data: {
      id: invoice.id,
      invoiceNumber: row?.invoice_number ?? invoice.invoiceNumber,
      clientName: client?.business_name || client?.full_name || "Selected client",
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      description,
      quantity,
      unitPrice,
      originalSubtotal,
      discount: Number(row?.discount_amount ?? discount),
      subtotal: Number(row?.subtotal ?? netSubtotal),
      taxTotal: Number(row?.gst_amount ?? 0),
      totalAmount: Number(row?.total_amount ?? netSubtotal),
      currency: row?.currency ?? invoice.currency,
      dueDate: row?.due_date ?? dueDate,
      status: row?.status ?? invoice.status,
      terms: row?.terms ?? invoice.terms ?? null,
      notes: row?.notes ?? notes ?? null,
    },
    message: "Invoice updated.",
  };
}

const aiWelcomeRefineSchema = z.object({
  welcomeDocId: z.string().uuid("Invalid welcome document id"),
  instruction: z.string().trim().min(2).max(2000),
});

/**
 * Refine an existing AI-drafted welcome document from a natural-language
 * instruction. Mirrors the contract refinement flow: re-draft the sections via
 * Groq applying the requested change, then persist with updateWelcomeDocumentAction.
 */
export async function refineWelcomeDocFromAiAction(
  input: z.infer<typeof aiWelcomeRefineSchema>,
) {
  const parsed = aiWelcomeRefineSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Tell me what to change in the welcome document." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: docRow } = await supabase
    .from("welcome_documents")
    .select("id, title, intro, content, client_id, project_id, acknowledgement_required, brand_color")
    .eq("id", parsed.data.welcomeDocId)
    .eq("user_id", userId)
    .maybeSingle();
  const doc = docRow as
    | {
        id: string;
        title: string;
        intro: string | null;
        content: string | null;
        client_id?: string | null;
        project_id?: string | null;
        acknowledgement_required?: boolean | null;
        brand_color?: string | null;
      }
    | null;
  if (!doc) return { ok: false as const, error: "Welcome document not found." };

  const existingSections = parseWelcomeContent(doc.content).map((s) => ({
    heading: s.heading,
    body: s.body,
  }));
  const currentText = existingSections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");
  const brief = [
    "Revise the EXISTING welcome/onboarding document below by applying the requested change.",
    "Keep every unchanged section intact; only modify what the change requires.",
    "",
    "CURRENT DOCUMENT:",
    currentText || "(empty document)",
    "",
    `REQUESTED CHANGE: ${parsed.data.instruction}`,
  ].join("\n");

  const fdDraft = new FormData();
  fdDraft.set(
    "payload",
    JSON.stringify({
      workflow: "welcome_document",
      prompt: brief,
      clientId: doc.client_id ?? "",
      projectId: doc.project_id ?? "",
    }),
  );
  const draftResult = await generateOperationalDraftAction(fdDraft);
  if (!draftResult.ok || !("sections" in draftResult.data)) {
    return {
      ok: false as const,
      error: draftResult.ok ? "Could not revise the welcome document." : draftResult.error,
    };
  }

  const draft = draftResult.data as AiWelcomeDraft;
  const sections = draft.sections.length > 0 ? draft.sections : existingSections;
  const title = cleanAiAnswer(draft.title) || doc.title;
  const intro = draft.intro ?? doc.intro ?? null;
  const acknowledgementRequired = draft.acknowledgementRequired ?? doc.acknowledgement_required ?? false;

  const res = await updateWelcomeDocumentAction({
    id: doc.id,
    title,
    intro,
    sections,
    clientId: doc.client_id ?? null,
    projectId: doc.project_id ?? null,
    brandColor: doc.brand_color ?? null,
    acknowledgementRequired,
  });
  if (!res.ok) return { ok: false as const, error: res.error };

  const { data: clientRow } = doc.client_id
    ? await supabase
        .from("clients")
        .select("full_name, business_name, email, phone")
        .eq("id", doc.client_id)
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const client = clientRow as
    | { full_name?: string | null; business_name?: string | null; email?: string | null; phone?: string | null }
    | null;

  let projectName: string | null = null;
  if (doc.project_id) {
    const { data: projectRow } = await supabase
      .from("projects")
      .select("name")
      .eq("id", doc.project_id)
      .eq("user_id", userId)
      .maybeSingle();
    projectName = (projectRow as { name?: string | null } | null)?.name ?? null;
  }

  return {
    ok: true as const,
    data: {
      id: doc.id,
      title,
      intro,
      sections,
      acknowledgementRequired,
      clientName: client?.business_name || client?.full_name || null,
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      projectName,
    },
    message: "Welcome document updated.",
  };
}

export async function answerFromDocsAction(input: z.infer<typeof aiDocsQuestionSchema>) {
  const parsed = aiDocsQuestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Ask a docs or support question first." };
  }

  // Extract readable prose from a marketing/docs page. We drop imports,
  // metadata, and noisy attributes (className/href) FIRST so the limited budget
  // is spent on real content — section titles, headings, and body copy — rather
  // than Tailwind class strings. Limits are generous so the whole docs page
  // fits (the previous 14k cap silently cut off everything past Invoices, which
  // is why questions about billing, GST, payments, etc. came back "not known").
  async function readPageText(relPath: string, limit = 60000): Promise<string> {
    try {
      const raw = await readFile(path.join(process.cwd(), "src", "app", relPath), "utf8");
      return raw
        .replace(/import[\s\S]*?from\s*["'][^"']*["'];?/g, " ")
        .replace(/export const (metadata|dynamic|NAV)[\s\S]*?;\n/g, " ")
        .replace(/className=\{?["'`][^"'`]*["'`]\}?/g, " ")
        .replace(/href=\{?["'][^"']*["']\}?/g, " ")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/[{}()<>=`"'$]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, limit);
    } catch {
      return "";
    }
  }

  const [docsText, privacyText, termsText] = await Promise.all([
    readPageText("(marketing)/docs/page.tsx", 60000),
    readPageText("(marketing)/privacy/page.tsx", 16000),
    readPageText("(marketing)/terms/page.tsx", 16000),
  ]);

  const combinedContext = [
    docsText ? `--- DOCS ---\n${docsText}` : "",
    privacyText ? `--- PRIVACY POLICY ---\n${privacyText}` : "",
    termsText ? `--- TERMS & CONDITIONS ---\n${termsText}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 90000);

  const ai = await generateStructuredJson({
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: [
          "You are Stackivo's friendly in-app assistant, talking directly to a Stackivo user (an Indian freelancer or agency owner).",
          "Answer their question in a warm, natural, conversational tone — like a helpful teammate, not a manual or a robot.",
          "Your source of truth is the provided Stackivo documentation, privacy policy, and terms.",
          "Guidelines:",
          "- Understand casual, natural phrasing and map it to the right topic (e.g. 'what about billing' → Plans & Billing; 'how do I get paid' / 'can clients pay online' → Payments/Razorpay; 'is my data safe' → privacy).",
          "- When the docs cover it, answer directly and confidently in your own words. Be concise (usually 1–4 short sentences); add clear step-by-step instructions only when they genuinely help. Don't paste raw doc text.",
          "- If the exact answer isn't in the docs, still give the closest helpful information you can, then point them to email support@stackivo.me or the in-app chat bubble. NEVER reply with a blunt 'I don't know' or 'not found in the docs'.",
          "- You may also help with general freelancing, invoicing, GST, contracts, and small-business questions from your own knowledge — be a genuinely useful assistant. But any claim about a Stackivo FEATURE, PRICE, or POLICY must be supported by the provided documentation; never invent those.",
          "- Use recentMessages to understand follow-up questions and references (e.g. after 'what are the plans?' a follow-up 'what about the business one?' means the Business plan).",
          "- For things that depend on their own account/data (their billing status, their numbers), explain how they can find or do it themselves.",
          "Set usedDocs to true when your answer relies on the provided documentation. Return JSON: { answer: string, usedDocs: boolean }.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          question: parsed.data.question,
          recentMessages: parsed.data.history ?? [],
          context: combinedContext,
          requiredShape: {
            answer: "string",
            usedDocs: "boolean",
          },
        }),
      },
    ],
  }).catch(() => null);

  const shaped = z
    .object({
      answer: z.string().min(1).max(3000),
      usedDocs: z.boolean(),
    })
    .safeParse(ai);

  if (!shaped.success) {
    return {
      ok: true as const,
      data: {
        answer:
          "Sorry, I couldn't pull that up just now — mind rephrasing, or telling me a bit more about what you're trying to do? You can also reach the team at support@stackivo.me or the chat bubble in the bottom-right.",
        usedDocs: false,
      },
    };
  }

  return { ok: true as const, data: shaped.data };
}

// ---------------------------------------------------------------------------
// Welcome document AI pipeline
// ---------------------------------------------------------------------------

const aiWelcomeDocIdSchema = z.object({
  welcomeDocId: z.string().uuid("Invalid welcome document id"),
});

export async function createWelcomeDocFromAiAction(input: AiCreateInput) {
  const parsed = aiCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Tell me what the welcome doc should cover." };
  }
  const fields = parsed.data.fields ?? {};

  const missing = nextMissingField("welcome_document", fields, {});
  if (missing) {
    return { ok: false as const, error: missing.question, missing };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const clientId = parsed.data.clientId || undefined;
  const projectId = parsed.data.projectId || undefined;

  const [{ data: clientRow }, { data: projectRow }] = await Promise.all([
    clientId
      ? supabase.from("clients").select("id, full_name, business_name, email, phone").eq("id", clientId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? supabase.from("projects").select("id, name").eq("id", projectId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const client = clientRow as { id: string; full_name?: string | null; business_name?: string | null; email?: string | null; phone?: string | null } | null;
  const project = projectRow as { id: string; name?: string | null } | null;

  const brief = briefFromFields(
    [
      ["Working relationship and what to expect", field(fields, "relationship")],
      ["Working style, communication, and process", field(fields, "process")],
      ["Payments, operations, and logistics", field(fields, "operations")],
      ["Tone", field(fields, "tone")],
    ],
    field(fields, "process"),
  );

  const fdDraft = new FormData();
  fdDraft.set("payload", JSON.stringify({
    workflow: "welcome_document",
    prompt: brief,
    clientId: parsed.data.clientId,
    projectId: parsed.data.projectId,
  }));
  const draftResult = await generateOperationalDraftAction(fdDraft);
  if (!draftResult.ok || !("sections" in draftResult.data)) {
    return { ok: false as const, error: draftResult.ok ? "Could not draft welcome document." : draftResult.error };
  }

  const draft = draftResult.data as AiWelcomeDraft;
  const clientDisplay = client?.business_name || client?.full_name || null;

  const res = await createWelcomeDocumentAction({
    title: draft.title || (clientDisplay ? `Welcome, ${clientDisplay}` : "Welcome document"),
    intro: draft.intro || null,
    sections: draft.sections,
    clientId: clientId ?? null,
    projectId: projectId ?? null,
    acknowledgementRequired: draft.acknowledgementRequired ?? false,
    brandColor: null,
  });
  if (!res.ok || !res.data?.id) {
    return { ok: false as const, error: res.ok ? "Welcome document was saved but id was not returned." : res.error };
  }

  return {
    ok: true as const,
    data: {
      id: res.data.id,
      title: draft.title,
      intro: draft.intro ?? null,
      sections: draft.sections,
      acknowledgementRequired: draft.acknowledgementRequired,
      clientName: clientDisplay,
      clientEmail: client?.email ?? null,
      clientPhone: client?.phone ?? null,
      projectName: project?.name ?? null,
    },
    message: "Welcome document draft created.",
  };
}

export async function approveWelcomeDocFromAiAction(
  input: z.infer<typeof aiWelcomeDocIdSchema>,
) {
  const parsed = aiWelcomeDocIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid welcome document." };
  const res = await publishWelcomeDocumentAction({ id: parsed.data.welcomeDocId });
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, message: "Welcome document published." };
}

export async function sendWelcomeDocFromAiAction(
  input: z.infer<typeof aiWelcomeDocIdSchema>,
) {
  const parsed = aiWelcomeDocIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid welcome document." };
  return sendWelcomeDocumentAction({ documentId: parsed.data.welcomeDocId });
}

export async function welcomeDocWhatsappFromAiAction(
  input: z.infer<typeof aiWelcomeDocIdSchema>,
) {
  const parsed = aiWelcomeDocIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid welcome document." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: docRow } = await supabase
    .from("welcome_documents")
    .select("id, title, client_id, public_token")
    .eq("id", parsed.data.welcomeDocId)
    .eq("user_id", userId)
    .maybeSingle();
  const doc = docRow as { id: string; title: string; client_id?: string | null; public_token?: string | null } | null;
  if (!doc) return { ok: false as const, error: "Welcome document not found." };

  const token = doc.public_token ?? await ensureWelcomePublicToken(doc.id);
  if (!token) return { ok: false as const, error: "Could not create share link." };

  const [{ data: clientRow }, { data: profileRow }] = await Promise.all([
    doc.client_id
      ? supabase.from("clients").select("full_name, business_name, phone").eq("id", doc.client_id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("user_profiles").select("business_name, legal_name, full_name, display_name").eq("id", userId).maybeSingle(),
  ]);
  const client = clientRow as { full_name?: string | null; business_name?: string | null; phone?: string | null } | null;
  const profile = profileRow as { business_name?: string | null; legal_name?: string | null; full_name?: string | null; display_name?: string | null } | null;

  const shareUrl = getWelcomeShareUrl(token, env.appUrl);
  const senderName = profile?.business_name || profile?.legal_name || profile?.display_name || profile?.full_name || "Stackivo";
  const clientName = client?.business_name || client?.full_name || null;
  const clientPhone = client?.phone ?? null;

  const message = `Hi${clientName ? ` ${clientName}` : ""}! ${senderName} has shared a welcome document with you. Open it here: ${shareUrl}`;
  const waBase = clientPhone ? `https://wa.me/${clientPhone.replace(/\D/g, "")}` : "https://wa.me/";
  const url = `${waBase}?text=${encodeURIComponent(message)}`;

  return { ok: true as const, data: { url, shareUrl } };
}

// ---------------------------------------------------------------------------
// Contract WhatsApp delivery
// ---------------------------------------------------------------------------

const aiContractWhatsappSchema = z.object({
  contractId: z.string().uuid("Invalid contract id"),
});

export async function contractWhatsappFromAiAction(
  input: z.infer<typeof aiContractWhatsappSchema>,
) {
  const parsed = aiContractWhatsappSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid contract." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: contractRow } = await supabase
    .from("contracts")
    .select("id, title, kind, client_id, value_amount, currency, public_token")
    .eq("id", parsed.data.contractId)
    .eq("user_id", userId)
    .maybeSingle();
  const contract = contractRow as {
    id: string;
    title: string;
    kind: string;
    client_id?: string | null;
    value_amount?: number | null;
    currency: string;
    public_token?: string | null;
  } | null;
  if (!contract) return { ok: false as const, error: "Contract not found." };

  // Mint or reuse public token — mirrors requestSignatureAction
  let token = contract.public_token ?? null;
  if (!token) {
    token = randomUUID();
    await supabase
      .from("contracts")
      .update({ public_token: token, status: "sent", sent_at: new Date().toISOString() } as never)
      .eq("id", contract.id);
  }

  const [{ data: clientRow }, { data: profileRow }] = await Promise.all([
    contract.client_id
      ? supabase.from("clients").select("full_name, business_name, phone").eq("id", contract.client_id).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("user_profiles").select("business_name, legal_name, full_name, display_name").eq("id", userId).maybeSingle(),
  ]);
  const client = clientRow as { full_name?: string | null; business_name?: string | null; phone?: string | null } | null;
  const profile = profileRow as { business_name?: string | null; legal_name?: string | null; full_name?: string | null; display_name?: string | null } | null;

  const shareUrl = getContractShareUrl(token);
  const senderName = profile?.business_name || profile?.legal_name || profile?.display_name || profile?.full_name || "Stackivo";
  const clientName = client?.business_name || client?.full_name || null;
  const clientPhone = client?.phone ?? null;
  const docLabel = contract.kind === "proposal" ? "proposal" : "contract";

  const message = `Hi${clientName ? ` ${clientName}` : ""}! ${senderName} has shared a ${docLabel} with you. Review and sign here: ${shareUrl}`;
  const waBase = clientPhone ? `https://wa.me/${clientPhone.replace(/\D/g, "")}` : "https://wa.me/";
  const url = `${waBase}?text=${encodeURIComponent(message)}`;

  return { ok: true as const, data: { url, shareUrl } };
}
