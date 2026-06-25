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
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const CANONICAL_FIELDS: Record<string, string[]> = {
  invoice: ["workDescription", "amount", "quantity", "dueDate", "discount", "notes"],
  contract: ["scope", "type", "commercials", "clauses", "amount"],
  welcome_document: ["relationship", "process", "operations", "tone"],
  client: ["fullName", "businessName", "email", "phone", "billingAddress", "state", "notes"],
  project: ["name", "scope", "status", "dates", "dueDate"],
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

/**
 * Match a workflow keyword in the text and report whether the keyword leads the
 * message. Returns null when no workflow keyword is present.
 */
function matchWorkflowKeyword(
  t: string,
): { intent: AiIntent; leads: boolean } | null {
  if (/\binvoice\b|\bbill\b|\bbilling\b|\breceipt\b|\bcharge\b/.test(t))
    return { intent: "invoice", leads: /^(invoice|bill|billing)\b/.test(t) };
  if (/\bcontract\b|\bagreement\b|\bproposal\b|\bnda\b|\bretainer\b/.test(t))
    return { intent: "contract", leads: /^(contract|agreement|proposal|nda|retainer)\b/.test(t) };
  if (/\bwelcome\b|\bonboard\b|\bonboarding\b|\bkickoff\b/.test(t))
    return { intent: "welcome_document", leads: /^(welcome|onboard)/.test(t) };
  if (/\bproject\b/.test(t)) return { intent: "project", leads: /^project\b/.test(t) };
  if (/\bclient\b|\bcustomer\b|\bcontact\b/.test(t)) return { intent: "client", leads: /^(client|customer|contact)\b/.test(t) };
  if (/\btime\b|\bhours?\b|\bminutes?\b|\blog time\b|\bbillable\b/.test(t)) return { intent: "time_entry", leads: false };
  return null;
}

// Terms that signal the user is asking about THEIR OWN business data/numbers.
const DATA_QUESTION =
  /\b(how much|how many|revenue|earned?|earnings|income|turnover|sales|paid|unpaid|owe[sd]?|outstanding|overdue|unbilled|receivable|collected|this month|last month|this year|this quarter|top client|best client|made|balance due)\b/;
const PRICING_TERMS = /\b(price|pricing|plan|plans|cost|subscription|upgrade)\b/;

function detectIntentLocally(text: string): { intent: AiIntent; confident: boolean } {
  const t = text.toLowerCase().trim();
  const action = ACTION_VERB.test(t);
  const question = looksLikeQuestion(t);
  const wf = matchWorkflowKeyword(t);

  // 0. A question about the user's own numbers — answer from their data, not
  //    the product docs. Excludes pricing/plan questions (those are support).
  if (DATA_QUESTION.test(t) && !action && !PRICING_TERMS.test(t)) {
    return { intent: "query", confident: true };
  }

  // 1. A clear command — an action verb together with a workflow keyword (e.g.
  //    "help me create a contract", "go ahead and make an invoice") — always
  //    starts that workflow, even if the message also contains a word like
  //    "help". This must win BEFORE the support catch below.
  if (wf && action) {
    return { intent: wf.intent, confident: true };
  }

  // 2. Explicit help/support topics and any action-free question are
  //    informational — answer them from the docs instead of starting a
  //    workflow. "plan/plans/pricing/billing plan" are pricing questions, not
  //    the invoice workflow.
  if (
    /\bsupport\b|\bbug\b|\bissue\b|\bhelp\b|how do\b|how to\b|how does\b|what is\b|what are\b|what about\b|\bprivacy\b|\bterms\b|\bpricing\b|\bprice\b|\bplans?\b|\brefund\b|\bgdpr\b|\bupgrade\b|\bsubscription\b/.test(
      t,
    )
  ) {
    return { intent: "support", confident: true };
  }
  if (question && !action) {
    return { intent: "support", confident: true };
  }

  // 3. A workflow keyword on its own — confident only when it leads the message.
  if (wf) {
    return { intent: wf.intent, confident: wf.leads };
  }

  return { intent: "general", confident: false };
}

function amountFromText(text: string): string {
  // Drop percentages, then understand k / lakh / crore suffixes and currency.
  const cleaned = text.replace(/\d+(?:\.\d+)?\s*%/g, " ").replace(/,/g, "");
  const suffix = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|lakhs?|lac|l|crores?|cr)\b/i);
  if (suffix) {
    const n = Number(suffix[1]);
    const unit = suffix[2].toLowerCase();
    const mult = unit.startsWith("k") ? 1e3 : unit.startsWith("c") ? 1e7 : 1e5;
    return String(Math.round(n * mult));
  }
  const match =
    cleaned.match(/(?:₹|rs\.?|inr|rup\w*)\s*(\d+(?:\.\d+)?)/i) ??
    cleaned.match(/(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rup\w*)/i) ??
    cleaned.match(/\b(\d{3,}(?:\.\d+)?)\b/);
  return match ? String(Math.round(Number(match[1]))) : "";
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

/** Levenshtein edit distance (small inputs — entity name words). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Fuzzy word equality — tolerant of small typos (e.g. "corp" vs "crop"). */
function fuzzyWordEq(a: string, b: string): boolean {
  if (a === b) return true;
  const allowed = b.length <= 4 ? 1 : 2;
  if (Math.abs(a.length - b.length) > allowed) return false;
  return editDistance(a, b) <= allowed;
}

function resolveEntity<T extends { id: string }>(
  text: string,
  items: T[],
  label: (item: T) => string,
): string | undefined {
  const haystack = ` ${normalize(text)} `;
  const tokens = normalize(text).split(" ").filter((w) => w.length >= 3);
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
      } else {
        // Typo-tolerant fallback: every significant word must FUZZY-match a
        // token in the message (handles "acme crop" -> "Acme Corp"). Scored
        // slightly lower so an exact match always wins.
        const fuzzy = significant.filter((w) => tokens.some((tk) => fuzzyWordEq(tk, w)));
        if (fuzzy.length === significant.length) {
          score = fuzzy.reduce((s, w) => s + w.length, 0) - 1;
        }
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
          "You are Stackivo's intelligence layer — the routing and extraction brain of a workflow tool for Indian freelancers and agencies.",
          "Read the user's message like a sharp human assistant: tolerate typos, slang, shorthand, casual phrasing and messy formatting. Work out the intent and pull out CLEAN, NORMALIZED structured data. Return ONLY JSON.",
          "",
          `INTENT — choose exactly one of: ${[...AI_WORKFLOWS, "general", "query"].join(", ")}.`,
          "- If the user clearly asks to start or switch task ('now create a client', 'actually make an invoice'), set that intent with confident=true.",
          "- If the message only adds detail to the current workflow, keep the current workflow as the intent.",
          "- For product/help questions use 'support'; for greetings or small talk use 'general'.",
          "- Use 'query' when the user ASKS ABOUT THEIR OWN business data/numbers — revenue, earnings, who paid / who owes, overdue or outstanding amounts, unbilled time/hours, top clients, this month / last month, GST collected, counts. ('how much did Acme pay me', 'what's overdue', 'revenue this month', 'who hasn't paid', 'unbilled hours on X'). Do NOT use 'support' for their own numbers — 'support' is only product help / how-to / pricing / plans / policy.",
          "",
          "FIELD KEYS by intent:",
          "- invoice: workDescription, amount, quantity, dueDate, discount, notes",
          "- contract: scope, type, commercials, clauses, amount",
          "- welcome_document: relationship, process, operations, tone",
          "- client: fullName, businessName, email, phone, billingAddress, state, notes",
          "- project: name, scope, status, dates, dueDate",
          "- time_entry: description, duration, billable",
          "- support: question, page",
          "",
          "NORMALIZE every value — do the interpretation HERE, never echo raw messy text for these:",
          "- Money (amount, fees, contract value): a plain integer/decimal in the selected client's currency, no symbols/separators. Understand Indian shorthand too: '₹1,50,000' / '1.5L' / '1.5 lakh' / '1,50,000 ruppees' = 150000; '50k' = 50000; '2cr' / '2 crore' = 20000000. NEVER treat a percentage like '50% upfront' as the amount.",
          "- discount: a percentage as '10%', or a flat amount in the selected client's currency as a plain number. Empty if none.",
          "- dueDate, and project dates/dueDate: an ISO date 'YYYY-MM-DD'. Resolve relative phrases against the provided 'today': 'tomorrow', 'in N days/weeks/months', 'next week', 'next month', 'end of month', weekday names. For a project, put a start in 'dates' and the deadline in 'dueDate'.",
          "- duration (time_entry): total MINUTES as an integer string ('2h 30m' = '150', '1.5 hours' = '90', '45m' = '45').",
          "- billable: 'true' or 'false'.",
          "- state (client): the full official Indian state/UT name ('Maharashtra', 'Madhya Pradesh'); infer from a clearly stated city ('Indore' = 'Madhya Pradesh').",
          "- email/phone: clean values; phone digits with optional +country code.",
          "- type (contract): one of proposal, agreement, nda, retainer when stated.",
          "",
          "CONTEXT: use recentMessages and alreadyCollected to understand the flow — resolve references ('the same client', 'that project'), corrections ('actually make it 6000', 'change the due date to next month'), and short follow-ups. When the user corrects a value, return the corrected field.",
          "CLIENT/PROJECT RESOLUTION: set clientId/projectId to an id from the provided lists ONLY when the message explicitly names that exact client/project. Never infer from generic words ('design', 'new', 'website') and never carry a client over from a previous task. Leave empty if unsure.",
          "",
          "RULES: extract only what the user actually stated or clearly implied — never invent amounts, taxes, ids, dates or private data. Omit a field (or use '') when unknown. Fix typos in meaning, do not invent facts.",
          "",
          'Return shape: {"intent":"...","confident":true|false,"fields":{...},"clientId":"","projectId":""}.',
          "",
          "Examples:",
          'message "invoice acme 1.5L for logo redesign, 10% off, due in 2 weeks", today "2026-06-08" -> {"intent":"invoice","confident":true,"fields":{"workDescription":"logo redesign","amount":"150000","discount":"10%","dueDate":"2026-06-22"},"clientId":"","projectId":""}',
          'message "logged 2h 30m on wireframes, billable" -> {"intent":"time_entry","confident":true,"fields":{"description":"wireframes","duration":"150","billable":"true"},"clientId":"","projectId":""}',
          'message "add rupal jain, rupal@acme.com, indore" -> {"intent":"client","confident":true,"fields":{"fullName":"Rupal Jain","email":"rupal@acme.com","state":"Madhya Pradesh"},"clientId":"","projectId":""}',
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          message: ctx.message,
          currentWorkflow: ctx.currentWorkflow ?? "general",
          alreadyCollected: ctx.collected ?? {},
          recentMessages: ctx.history ?? [],
          clients: clientList,
          projects: projectList,
          fieldKeysByIntent: CANONICAL_FIELDS,
          today: new Date().toISOString().slice(0, 10),
        }),
      },
    ],
  }).catch(() => null);

  if (!aiJson || typeof aiJson !== "object") return fallback;

  const raw = aiJson as Record<string, unknown>;
  const intentRaw = typeof raw.intent === "string" ? raw.intent : "";
  const intent = ([...AI_WORKFLOWS, "general", "query"] as string[]).includes(intentRaw)
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
