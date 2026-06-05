import "server-only";

import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { generateStructuredJson } from "./groq";
import {
  AI_WORKFLOWS,
  type AiFields,
  type AiIntent,
  type AiInterpretation,
} from "./types";

interface InterpretContext {
  message: string;
  currentWorkflow?: AiIntent;
  collected?: AiFields;
  clients: ClientRecord[];
  projects: ProjectRecord[];
}

const CANONICAL_FIELDS: Record<string, string[]> = {
  invoice: ["workDescription", "amount", "quantity", "dueDate", "discount", "notes"],
  contract: ["scope", "type", "commercials", "clauses", "amount"],
  welcome_document: ["relationship", "process", "operations", "tone"],
  client: ["fullName", "businessName", "email", "phone", "billingAddress", "notes"],
  project: ["name", "scope", "status", "dates"],
  time_entry: ["description", "duration", "billable"],
  support: ["question", "page"],
};

// ---------------------------------------------------------------------------
// Deterministic fallback (used when Groq is unavailable or returns junk)
// ---------------------------------------------------------------------------

// Verbs that signal the user wants to *perform* an action (create something),
// as opposed to merely asking about it.
const ACTION_VERB =
  /\b(create|make|draft|add|new|start|log|raise|generate|send|prepare|build|issue|set ?up|register|record|bill)\b/;

/**
 * A message is informational (a question to answer from docs) rather than a
 * command when it reads like a question and carries no action verb. Examples:
 * "what about billing", "how do invoices work?", "is my data private".
 */
function looksLikeQuestion(t: string): boolean {
  if (/\?\s*$/.test(t)) return true;
  return /^(what|whats|what'?s|what about|how|how about|why|when|where|who|which|can i|can you|could (i|you)|should i|do (i|you)|does|did|is|are|will|would|tell me|explain|i (want|need) to know|any (info|information|details))\b/.test(
    t,
  );
}

function detectIntentLocally(text: string): { intent: AiIntent; confident: boolean } {
  const t = text.toLowerCase().trim();
  const action = ACTION_VERB.test(t);
  const question = looksLikeQuestion(t);

  // 1. Explicit help/support topics and any action-free question are
  //    informational — answer them from the docs instead of starting a
  //    workflow. This is what makes "what about billing" return an answer
  //    rather than silently opening the invoice flow.
  if (/\bsupport\b|\bbug\b|\bissue\b|\bhelp\b|how do\b|how to\b|how does\b|what is\b|what are\b|what about\b|\bprivacy\b|\bterms\b|\bpricing\b|\brefund\b|\bgdpr\b/.test(t)) {
    return { intent: "support", confident: true };
  }
  if (question && !action) {
    return { intent: "support", confident: true };
  }

  // 2. Actionable workflows. "confident" (used to switch tasks mid-flow) is set
  //    when an action verb is present or the message leads with the keyword.
  if (/\binvoice\b|\bbill\b|\bbilling\b|\breceipt\b|\bcharge\b/.test(t))
    return { intent: "invoice", confident: action || /^(invoice|bill|billing)\b/.test(t) };
  if (/\bcontract\b|\bagreement\b|\bproposal\b|\bnda\b|\bretainer\b/.test(t))
    return { intent: "contract", confident: action || /^(contract|agreement|proposal|nda|retainer)\b/.test(t) };
  if (/\bwelcome\b|\bonboard\b|\bonboarding\b|\bkickoff\b/.test(t))
    return { intent: "welcome_document", confident: action || /^(welcome|onboard)/.test(t) };
  if (/\bproject\b/.test(t)) return { intent: "project", confident: action || /^project\b/.test(t) };
  if (/\bclient\b|\bcustomer\b|\bcontact\b/.test(t)) return { intent: "client", confident: action || /^(client|customer|contact)\b/.test(t) };
  if (/\btime\b|\bhours?\b|\bminutes?\b|\blog time\b|\bbillable\b/.test(t)) return { intent: "time_entry", confident: action };

  return { intent: "general", confident: false };
}

function amountFromText(text: string): string {
  const normalized = text.replace(/,/g, "");
  const match =
    normalized.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i) ??
    normalized.match(/(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr)/i) ??
    normalized.match(/\b(\d{3,}(?:\.\d+)?)\b/);
  return match ? match[1] : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Common words that must never, on their own, resolve a client/project — they
// cause false matches like "design the homepage" → client "Acme Design".
const ENTITY_STOPWORDS = new Set([
  "new", "the", "and", "for", "you", "our", "your", "this", "that", "with",
  "client", "clients", "project", "projects", "invoice", "contract", "proposal",
  "create", "make", "add", "draft", "welcome", "document", "design", "studio",
  "services", "solutions", "company", "pvt", "ltd", "inc", "llp",
]);

function resolveEntity<T extends { id: string }>(
  text: string,
  items: T[],
  label: (item: T) => string,
): string | undefined {
  const haystack = ` ${normalize(text)} `;
  let best: { id: string; score: number } | null = null;
  for (const item of items) {
    const name = normalize(label(item));
    if (!name || name.length < 3) continue;
    const significant = name
      .split(" ")
      .filter((w) => w.length >= 3 && !ENTITY_STOPWORDS.has(w));
    // A name made up entirely of stop words can't be matched safely.
    if (significant.length === 0) continue;

    let score = 0;
    if (haystack.includes(` ${name} `)) {
      // The full name appears verbatim — strongest signal.
      score = name.length + 100;
    } else {
      // Otherwise require EVERY significant word to be present, so a single
      // incidental word can't resolve a multi-word client/project.
      const matched = significant.filter((w) => haystack.includes(` ${w} `));
      if (matched.length === significant.length) {
        score = matched.reduce((s, w) => s + w.length, 0);
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { id: item.id, score };
  }
  return best?.id;
}

function localFields(intent: AiIntent, text: string): AiFields {
  const fields: AiFields = {};
  if (intent === "invoice" || intent === "contract") {
    const amount = amountFromText(text);
    if (amount) fields.amount = amount;
  }
  if (intent === "support") fields.question = text;
  return fields;
}

function localInterpret(ctx: InterpretContext): AiInterpretation {
  const { intent, confident } = detectIntentLocally(ctx.message);
  const effective = intent === "general" && ctx.currentWorkflow ? ctx.currentWorkflow : intent;
  const clientId = resolveEntity(ctx.message, ctx.clients, (c) => getClientDisplayName(c));
  const projectId = resolveEntity(ctx.message, ctx.projects, (p) => p.name);
  return {
    intent: effective,
    confident,
    fields: localFields(effective, ctx.message),
    clientId,
    projectId,
    provider: "local",
  };
}

// ---------------------------------------------------------------------------
// Groq-powered interpretation
// ---------------------------------------------------------------------------

export async function interpretMessage(ctx: InterpretContext): Promise<AiInterpretation> {
  const fallback = localInterpret(ctx);

  const clientList = ctx.clients.slice(0, 200).map((c) => ({
    id: c.id,
    name: getClientDisplayName(c),
    business: c.businessName ?? "",
  }));
  const projectList = ctx.projects.slice(0, 200).map((p) => ({
    id: p.id,
    name: p.name,
    clientId: p.clientId,
  }));

  const aiJson = await generateStructuredJson({
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: [
          "You are the routing + extraction brain of Stackivo, a workflow automation tool for freelancers and agencies.",
          "Classify the user's message into exactly one intent and extract structured fields. Return ONLY JSON.",
          `Valid intents: ${[...AI_WORKFLOWS, "general"].join(", ")}.`,
          "If the user clearly asks to start or switch to a different task (e.g. 'now create a client', 'actually make an invoice'), set intent to that task and confident=true.",
          "If the message just adds detail to the current workflow, keep the current workflow as the intent.",
          "Resolve clientId/projectId to an id from the provided lists ONLY when the message explicitly names that exact client/project. Never infer a client from generic words (e.g. 'design', 'new', 'website') and never carry over a client from a previous task — leave the id empty if unsure.",
          "Never invent ids, money totals, taxes, or private data. Extract only what the user stated.",
          "Field keys by intent — invoice: workDescription, amount, quantity, dueDate, discount, notes; contract: scope, type, commercials, clauses, amount; welcome_document: relationship, process, operations, tone; client: fullName, businessName, email, phone, billingAddress, notes; project: name, scope, status, dates; time_entry: description, duration, billable; support: question, page.",
          "amount/discount must be plain numbers as strings (no currency symbols). billable is 'true' or 'false'.",
          'Return shape: {"intent":"...","confident":true,"fields":{...},"clientId":"","projectId":""}.',
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          message: ctx.message,
          currentWorkflow: ctx.currentWorkflow ?? "general",
          alreadyCollected: ctx.collected ?? {},
          clients: clientList,
          projects: projectList,
          fieldKeysByIntent: CANONICAL_FIELDS,
        }),
      },
    ],
  }).catch(() => null);

  if (!aiJson || typeof aiJson !== "object") return fallback;

  const raw = aiJson as Record<string, unknown>;
  const intentRaw = typeof raw.intent === "string" ? raw.intent : "";
  const intent = ([...AI_WORKFLOWS, "general"] as string[]).includes(intentRaw)
    ? (intentRaw as AiIntent)
    : fallback.intent;

  const fields: AiFields = {};
  if (raw.fields && typeof raw.fields === "object") {
    for (const [key, value] of Object.entries(raw.fields as Record<string, unknown>)) {
      if (value === null || value === undefined) continue;
      const str = String(value).trim();
      if (str) fields[key] = str;
    }
  }

  // Trust an explicit, validated id; otherwise fall back to local resolution.
  const clientId =
    (typeof raw.clientId === "string" && ctx.clients.some((c) => c.id === raw.clientId)
      ? raw.clientId
      : undefined) ?? fallback.clientId;
  const projectId =
    (typeof raw.projectId === "string" && ctx.projects.some((p) => p.id === raw.projectId)
      ? raw.projectId
      : undefined) ?? fallback.projectId;

  return {
    intent,
    confident: raw.confident === true,
    fields: { ...fallback.fields, ...fields },
    clientId,
    projectId,
    provider: "groq",
  };
}
