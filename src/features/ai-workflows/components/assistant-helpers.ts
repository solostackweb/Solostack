import {
  Sparkles,
  ReceiptText,
  FileSignature,
  FileText,
  Users,
  LayoutDashboard,
  Clock,
  Headphones,
} from "lucide-react";

import type { AiMode } from "./assistant-types";

/**
 * Pure helpers + constants for the Stackivo AI assistant (no React state).
 * Extracted from the main component so it stays focused on orchestration.
 */

export const QUICK_ACTIONS: Array<{
  mode: AiMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    mode: "invoice",
    title: "Create invoice",
    description: "Draft and approve an invoice from a single prompt.",
    icon: ReceiptText,
  },
  {
    mode: "contract",
    title: "Draft contract",
    description: "Generate a full agreement or proposal with all clauses.",
    icon: FileSignature,
  },
  {
    mode: "welcome_document",
    title: "Welcome doc",
    description: "Prepare a polished onboarding guide for a client.",
    icon: FileText,
  },
  {
    mode: "client",
    title: "Add client",
    description: "Create a client record from a description.",
    icon: Users,
  },
  {
    mode: "project",
    title: "Add project",
    description: "Create a project and link it to a client.",
    icon: LayoutDashboard,
  },
  {
    mode: "time_entry",
    title: "Log time",
    description: "Record billable hours against a project.",
    icon: Clock,
  },
  {
    mode: "support",
    title: "Support",
    description: "Ask a question or submit a support request.",
    icon: Headphones,
  },
];

// ---------------------------------------------------------------------------
// Per-mode placeholder hints (free-form; the NLU extracts and asks for gaps)
// ---------------------------------------------------------------------------

export const MODE_PLACEHOLDERS: Partial<Record<AiMode, string>> = {
  invoice: "Example: Invoice Acme 25000 for website redesign, due in 15 days, 5000 off",
  contract: "Example: Service agreement for Acme — 5-page site, INR 150000, 50% upfront, 2 revisions",
  welcome_document: "Example: Welcome doc for Acme — weekly Friday updates, feedback in one doc, warm tone",
  client: "Example: Add Riya Sharma, Acme Encore, riya@acme.com, +91 9876543210, Mumbai",
  project: "Example: Website Redesign for Acme — landing page + CMS, starts Monday, due end of month",
  time_entry: "Example: Logged 2h 30m on wireframe revisions for Acme, billable",
  support: "Ask anything — docs, privacy, terms, or raise a support ticket",
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function formatMoney(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAiMoney(amount: number | null | undefined, currency = "INR") {
  if (!amount) return "";
  return formatMoney(amount, currency);
}

export function modeIntro(mode: AiMode): string {
  switch (mode) {
    case "invoice":
      return "Let's create an invoice. Describe the client, work, amount, and due date.";
    case "contract":
      return "Let's draft a contract or proposal. I'll walk you through it.";
    case "welcome_document":
      return "Let's prepare a welcome document. A few questions and I'll generate the full guide.";
    case "client":
      return "Let's add a client. Tell me the details and I'll create the record.";
    case "project":
      return "Let's create a project. Tell me the name, scope, and timeline.";
    case "time_entry":
      return "Let's log some time. Which project and how long?";
    case "support":
      return "I can answer from docs, privacy, or terms — or send this to support.";
    default:
      return "What would you like to do?";
  }
}

/** The assistant's name — friendly, human, and drawn from "Stack-ivo". */
export const ASSISTANT_NAME = "Ivo";

/**
 * Quick, human conversational replies for greetings, small talk and meta
 * questions so Ivo answers warmly instead of running a docs lookup that finds
 * nothing. Returns null for substantive questions, which fall through to the
 * docs / data flow.
 */
export function conversationalReply(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/[!.?,]+$/g, "");

  // Greetings — tolerant of common typos (helo, helloo, hii, heyy, gud morning).
  if (/^(hi+|hey+|h(e|a)l+o+|hii+|heyy+|yo+|hiya|hello+|namaste|namaskar|hii?ya|good ?(morning|afternoon|evening|day)|gud ?(morning|mrng|eve))\b/.test(t)) {
    return "Hey there! \u{1F44B} I'm Ivo, your Stackivo assistant. I can create invoices, contracts and welcome docs, add clients and projects, log time, or just answer a question. What's on your plate today?";
  }
  if (/^(thanks?|thank ?(you|u)|thnx|thnks|thanx|thx|ty|tysm|great|perfect|awesome|cool|nice|ok+|okay|okey|k|got it|cheers|appreciate it)( (so much|a lot|you|u|man|mate|buddy|bro))?$/.test(t)) {
    return "Anytime! \u{1F642} What would you like to do next?";
  }
  if (/\b(can|could|may) i ask( you)?( a| you a)? ?(question|something|doubt)?\b|^ask you|are you (there|online|here)|you there/.test(t)) {
    return "Of course \u2014 ask away. I can help with invoices, contracts, welcome docs, clients, projects, time logs, or how Stackivo works.";
  }
  if (/what'?s your name|whats your name|your name|who are you|what are you/.test(t)) {
    return "I'm Ivo \u2014 your built-in Stackivo assistant. Think of me as the teammate who handles the invoicing, contracts and admin so you can focus on the actual work. What can I do for you?";
  }
  if (/what can you do|how can you help|what do you do|how do you work/.test(t)) {
    return "Quite a lot! I can draft and send invoices & contracts, prepare welcome documents, add clients and projects, log billable time, and answer questions about Stackivo or freelancing in general. Just describe what you need \u2014 like \u201cInvoice Acme $1,200 for a landing page, due in 15 days.\u201d";
  }
  if (/how are you|how'?s it going|how do you do|how have you been|hope you('| a)re (doing )?(well|good)/.test(t)) {
    return "Doing great, thanks for asking! \u{1F60A} More importantly \u2014 how can I help you today?";
  }
  if (/\bare you (a )?(bot|robot|ai|human|real)\b|who (made|built|created) you|are you chatgpt/.test(t)) {
    return "I'm Ivo, Stackivo's built-in AI assistant \u2014 here to take the busywork off your plate. Want me to create an invoice, draft a contract, or answer something?";
  }
  // Light empathy for venting / a rough day, then gently offer to help.
  if (/^(i'?m|im|feeling|so|really) (tired|exhausted|stressed|busy|overwhelmed|swamped|drained|done)\b|too much work|so much work|long day|rough day|tough day|hate (invoicing|paperwork|admin|this)/.test(t)) {
    return "I hear you \u2014 running things solo is a lot. \u{1F499} Let me take some off your plate: I can chase overdue invoices, draft an invoice from a single line, or set up a contract. Want me to handle one of those?";
  }
  if (/^(bye+|goodbye|see ya|see you|cya|good ?night|gn|gtg|talk later|that'?s all|nothing else|i'?m good|no that'?s it)$/.test(t)) {
    return "Catch you later! \u{1F44B} I'm right here whenever you need me.";
  }
  return null;
}

/**
 * True when a message reads like a question to answer (from docs) rather than a
 * command to create something — e.g. "what about billing?", "how do invoices
 * work". Used so the home screen answers such messages instead of opening a
 * workflow. A clear action verb ("create an invoice…") opts out.
 */
export function isInformationalQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\b(create|make|draft|add|new|start|log|raise|generate|send|prepare|build|issue|set ?up)\b/.test(t)) {
    return false;
  }
  if (/\?\s*$/.test(t)) return true;
  return /^(what|whats|what'?s|what about|how|how about|why|when|where|who|which|can i|can you|could (i|you)|should i|do (i|you)|does|did|is|are|will|would|tell me|explain)\b/.test(
    t,
  );
}

/** True when the user is asking about their own business metrics/data. */
export function isBusinessDataQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/\b(price|pricing|plan|plans|cost|subscription|upgrade)\b/.test(t)) {
    return false;
  }
  return /\b(how much|how many|revenue|earned?|earnings|income|turnover|sales|paid|unpaid|owe[sd]?|outstanding|overdue|unbilled|receivable|collected|this month|last month|this year|this quarter|top clients?|best clients?|biggest clients?|largest clients?|top customer|best customer|made|balance due|collection rate|concentration|cash ?flow|business summary|how am i doing|what should i focus on|what should i do today|priorit(?:y|ies)|today'?s focus|today'?s priorities)\b/.test(
    t,
  );
}

/** Matches a short "skip"/"none" style reply to an optional prompt. */
export function isSkipReply(text: string): boolean {
  return /^(skip|none|no|n\/a|na|nope|nah|leave it|not now|-|—)$/i.test(text.trim());
}

/**
 * Sanity-check a typed answer against the field it's meant to fill. Returns a
 * gentle correction string when the answer clearly can't work (e.g. no number
 * for an amount, no time unit for a duration, no date for a due date) so the
 * assistant can re-ask instead of silently saving nonsense. Returns null when
 * the answer looks plausible (we stay lenient — better to accept than to nag).
 */
export function fieldValidationError(field: string, text: string): string | null {
  const t = text.trim();
  const hasNumber = /\d/.test(t);
  switch (field) {
    case "amount":
      if (!hasNumber)
        return "I need a number for the amount, in the selected client's invoice currency. For example: 50000, 1.5L, or 1200. How much should I invoice?";
      return null;
    case "duration":
      if (!hasNumber)
        return "Tell me how long in hours/minutes — for example “2h 30m” or “45m”. And is it billable?";
      return null;
    case "dueDate":
      // A date, a relative phrase, or "skip" are all fine.
      if (
        !hasNumber &&
        !/\b(today|tomorrow|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eom|end of)\b/i.test(t)
      )
        return "When is it due? Try “in 15 days”, “next month”, a date like 2026-07-01 — or reply “skip”.";
      return null;
    case "email":
      if (!/^\S+@\S+\.\S+$/.test(t))
        return "That doesn't look like an email address — for example “name@company.com”. What's their email?";
      return null;
    default:
      return null;
  }
}

/** A short affirmative reply to a confirmation prompt ("yes", "go ahead"). */
export function isAffirmative(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  return /^(y|yes+|yeah|yep|yup|ok|okay|sure|confirm|confirmed|create|create it|do it|go ahead|proceed|send it|sounds good|looks good|perfect|all good|that'?s right|correct)$/.test(
    t,
  );
}

/** A short negative/cancel reply to a confirmation prompt. */
export function isNegative(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  return /^(n|no|nope|nah|cancel|stop|don'?t|do not|abort|discard|wait|never mind|nevermind)$/.test(
    t,
  );
}

/**
 * Detects an intent to ABANDON the current workflow ("leave it", "cancel
 * this", "let's do something else", "forget the contract", "never mind").
 * Used to gracefully exit any in-progress flow (pending question, picker, or
 * open draft) instead of re-asking. Phrased to avoid false positives on real
 * answers — it looks for explicit drop/leave/cancel language.
 */
export function isAbandonFlow(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[!.]+$/g, "");
  if (/^(cancel|stop|abort|forget it|never ?mind|leave it|drop it|exit|quit)$/.test(t)) {
    return true;
  }
  return /\b(leave|drop|cancel|forget|skip|abandon|stop)\b.*\b(this|that|the (invoice|contract|proposal|client|project|welcome|document|doc|time)|it)\b/.test(
    t,
  ) ||
    /\b(do|try|create|make|something) (something )?(else|different|other)\b/.test(t) ||
    /\b(let'?s|lets|i want to|can we|how about we) (do|try) something else\b/.test(t) ||
    /\bnever ?mind\b|\bforget (it|the|this|that)\b/.test(t);
}
