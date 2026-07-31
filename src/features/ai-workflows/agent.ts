import "server-only";

/**
 * The Ivo agent loop — the model-driven brain that replaced the regex router.
 *
 * Architecture:
 *   1. The model receives the conversation, a compact workspace snapshot, and
 *      a set of tools.
 *   2. READ tools (business snapshot, record lists, invoice lookup) execute
 *      inline and feed results back into the loop, so the model can ground
 *      every answer in the user's real data.
 *   3. ROUTE tools terminate the loop by translating the model's chosen action
 *      into the existing `IvoRuntimeDecision` protocol — workflows, pickers,
 *      approval-gated drafts and reminder proposals all reuse the exact same
 *      guarded execution paths as before. The model never writes to the
 *      database directly.
 *   4. If the model answers in plain language (no route tool), that text is
 *      returned as `say` with a `{ kind: "reply" }` decision.
 *
 * When Groq is unavailable the caller falls back to the deterministic
 * NLU + planner path, so Ivo degrades instead of breaking.
 */

import { getServerSupabase } from "@/lib/supabase/server";
import { log } from "@/lib/logger";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { getBusinessFacts } from "./business-context";
import {
  asRetrieval,
  retrievalUnavailable,
  type IvoRetrieval,
} from "./retrieval";
import {
  generateToolChat,
  type GroqAgentMessage,
  type GroqToolCall,
  type GroqToolDefinition,
} from "./groq";
import { planIvoWorkflowNextAction } from "./workflow-progress";
import type { AiFields, AiWorkflow } from "./types";
import { AI_WORKFLOWS, NO_CLIENT_SENTINEL, NO_PROJECT_SENTINEL } from "./types";
import type { IvoMode, IvoRuntimeDecision } from "./conversation-types";
import {
  formatIvoResourceContext,
  type IvoResolvedResource,
} from "./resource-mentions";

const MAX_ROUNDS = 4;
// Tool-result size is now budgeted in `retrieval.ts`, which drops whole
// records rather than slicing the serialised payload mid-token.

export interface IvoAgentInput {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userId: string;
  firstName: string | null;
  currentMode: IvoMode;
  collected: AiFields;
  /** Client/project already chosen in the UI (real id, or a "no client/project"
   *  sentinel). Carried into start_task so a picked value is never re-asked. */
  clientId?: string;
  projectId?: string;
  pendingField?: { field: string; optional?: boolean };
  activeDraft?: { entityType: "invoice" | "contract" | "welcome_document"; entityId: string };
  /** Dashboard route the user sent the message from (e.g. "/dashboard/pulse"). */
  page?: string;
  clients: ClientRecord[];
  projects: ProjectRecord[];
  /** Exact workspace records explicitly attached to this message with @mentions. */
  resources?: IvoResolvedResource[];
  requestId: string;
  /** Live progress callback ("Reading your invoices…") for streaming UIs. */
  onStatus?: (status: string) => void;
  /** Token-level callback forwarding the model's text as it is generated. */
  onDelta?: (text: string) => void;
  /** Pre-loaded memories (lets callers parallelise the fetch); loaded here if absent. */
  memories?: string[];
}

export interface IvoAgentResult {
  say: string;
  suggestions: string[];
  decision: IvoRuntimeDecision;
  model: string | null;
  rounds: number;
  promptTokens: number;
  completionTokens: number;
  reads: Array<{
    tool: string;
    scope: string;
    status: IvoRetrieval["status"];
  }>;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

function buildTools(input: IvoAgentInput): GroqToolDefinition[] {
  const tools: GroqToolDefinition[] = [
    {
      type: "function",
      function: {
        name: "get_business_snapshot",
        description:
          "Read the user's real business numbers: revenue (12m/this month), outstanding & overdue invoices with aging, collection rate, avg days to pay, top clients by revenue with concentration %, revenue by project, tracked/billable hours, unbilled time value by project, and GST totals. ALWAYS call this before answering any question about the user's numbers, priorities, follow-ups, risk, or business health. Never invent figures.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    {
      type: "function",
      function: {
        name: "list_records",
        description:
          "Read the user's records. Use to review/inspect invoices, contracts & proposals, clients, projects, or welcome documents before advising. Returns compact rows (id, label, client, status, amount, dates).",
        parameters: {
          type: "object",
          properties: {
            entityType: {
              type: "string",
              enum: ["invoice", "contract", "client", "project", "welcome_document"],
            },
            filter: {
              type: "string",
              enum: ["all", "unpaid", "overdue", "pending", "active", "open"],
              description:
                "invoice: unpaid|overdue|all · contract: pending|all (contracts include proposals; each row has kind) · project: active|all · welcome_document: open|all · client: all",
            },
          },
          required: ["entityType", "filter"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_leads",
        description:
          "Read incoming leads captured by the user's public lead forms: name, email, company, project summary, budget, timeline, status, and when they arrived. Use before drafting a lead reply, advising on lead follow-up, or answering 'any new leads?'.",
        parameters: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["open", "new", "converted", "all"],
              description: "open = new + reviewed (default). Use 'all' to include converted/archived.",
            },
          },
          required: [],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "list_meetings",
        description:
          "Read the user's meetings: topic, client, duration, scheduled time, and status (proposed = awaiting the client to pick a slot, confirmed = booked). Use for schedule questions, meeting prep, or spotting unconfirmed meetings to nudge.",
        parameters: {
          type: "object",
          properties: {
            scope: {
              type: "string",
              enum: ["upcoming", "awaiting_confirmation", "all"],
            },
          },
          required: ["scope"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "get_client_profile",
        description:
          "Deep-dive on ONE client: their record (email, phone, GST, currency), invoice totals (paid / outstanding / overdue), recent invoices, projects, contracts & proposals, and meetings. Use for briefings ('tell me about X', 'prep me for my call with X'), payment-history questions, or before drafting anything client-specific.",
        parameters: {
          type: "object",
          properties: {
            clientName: { type: "string", description: "The client's name (as the user said it)." },
          },
          required: ["clientName"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "remember",
        description:
          "Save ONE durable, cross-conversation PREFERENCE to long-term memory — e.g. 'Standard rate is ₹2,500/hr', 'Always Net-15 for Kumar Associates', 'Sign emails as Arpit from Developer Bazaar'. Use ONLY when the user states a lasting preference or explicitly says to remember something. NEVER remember an action or anything about the current task: not what was created/sent/started, not a one-off amount/date/client for this document, not 'the user is making a proposal', not conversation state. If it wouldn't still be true and useful in an unrelated chat next month, do not store it. Never store secrets or other people's private data.",
        parameters: {
          type: "object",
          properties: {
            fact: { type: "string", description: "The preference, phrased compactly in third person (max ~200 chars)." },
          },
          required: ["fact"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "find_invoice",
        description:
          "Look up specific invoices by invoice number (e.g. 'INV-0012') or client name. Returns full details: client, email, amount, currency, status, issue & due dates. Use before drafting payment reminders or answering questions about a specific invoice.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Invoice number or client name" },
          },
          required: ["query"],
        },
      },
    },
    // ---- ROUTE tools (terminate the loop) --------------------------------
    {
      type: "function",
      function: {
        name: "start_task",
        description:
          "Start (or continue) a guided creation task: draft an invoice, a proposal (task='proposal'), a contract/NDA/retainer (task='contract'), a welcome document, create a client, project, or time entry, or schedule a meeting/call (task='meeting'). Pass every detail the user already gave in `fields` so they are never asked twice. The UI then walks the user through anything missing with pickers. A proposal is its OWN task — use task='proposal', NOT task='contract'.",
        parameters: {
          type: "object",
          properties: {
            task: { type: "string", enum: [...AI_WORKFLOWS.filter((w) => w !== "support")] },
            fields: {
              type: "object",
              description:
                "String key/values already provided by the user. invoice: workDescription, amount, quantity, dueDate, discount, notes · contract: scope, type (agreement|nda|retainer), commercials, clauses, amount · proposal: scope, commercials, timeline, amount · welcome_document: relationship, process, operations, tone · client: fullName, businessName, email, phone, billingAddress, state, notes · project: name, scope, status, dates, dueDate · time_entry: description, duration (minutes), billable ('true'|'false') · meeting: topic, meetingLength (e.g. '30 minutes'). Normalize values (amounts as plain numbers, dates as YYYY-MM-DD). EXCEPTION: for discount, keep it EXACTLY as written — a percentage MUST keep its '%' (e.g. '10%' stays '10%', never '10'); a flat amount is a plain number. Stripping the % changes the money.",
              additionalProperties: { type: "string" },
            },
            clientId: {
              type: "string",
              description: "Client id from the workspace list ONLY when the user explicitly named that client. Otherwise omit.",
            },
            projectId: { type: "string", description: "Project id ONLY when explicitly named." },
            reply: {
              type: "string",
              description: "One short friendly sentence acknowledging what you're setting up. The UI asks the follow-up questions.",
            },
          },
          required: ["task", "reply"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "show_records",
        description:
          "Render an interactive card list of records in the chat for the user to open. Use when the user asks to SEE/LIST records. (For analysis, use list_records instead and answer in text — you can do both: analyse with list_records, then call show_records with your findings in `reply`.)",
        parameters: {
          type: "object",
          properties: {
            entityType: {
              type: "string",
              enum: ["invoice", "contract", "client", "project", "welcome_document"],
            },
            filter: {
              type: "string",
              enum: ["all", "unpaid", "overdue", "pending", "active", "open"],
            },
            reply: { type: "string", description: "One short sentence introducing the list, or your analysis of it." },
          },
          required: ["entityType", "filter", "reply"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "propose_overdue_reminders",
        description:
          "Offer to email a payment reminder to every client with an overdue invoice. The user must confirm before anything is sent. Use when they ask to chase/remind/follow up overdue payments in bulk.",
        parameters: {
          type: "object",
          properties: {
            reply: { type: "string", description: "One sentence explaining what will be sent, ending by asking for confirmation." },
          },
          required: ["reply"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "invoice_unbilled_time",
        description:
          "Create a draft invoice from the user's unbilled tracked time. Only use when they explicitly ask to bill/invoice their unbilled time — for questions about unbilled time, use get_business_snapshot and answer in text.",
        parameters: {
          type: "object",
          properties: {
            send: { type: "boolean", description: "true only if the user explicitly asked to also send it." },
            clientId: { type: "string", description: "Optional client id filter." },
            reply: { type: "string", description: "One short sentence about the draft being prepared." },
          },
          required: ["send", "reply"],
        },
      },
    },
  ];

  if (input.activeDraft) {
    tools.push({
      type: "function",
      function: {
        name: "refine_active_draft",
        description: `The user has an open ${input.activeDraft.entityType.replace("_", " ")} draft in this conversation. Call this to apply their latest message as a refinement instruction to that draft (e.g. "make it 6000", "add a confidentiality clause").`,
        parameters: {
          type: "object",
          properties: {
            reply: { type: "string", description: "One short sentence acknowledging the update." },
          },
          required: ["reply"],
        },
      },
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// READ tool executors
// ---------------------------------------------------------------------------

async function execListRecords(
  userId: string,
  entityType: string,
  filter: string,
): Promise<unknown> {
  const supabase = await getServerSupabase();
  const today = new Date().toISOString().slice(0, 10);

  if (entityType === "invoice") {
    let query = supabase
      .from("invoices")
      .select("id, invoice_number, client_id, total_amount, currency, status, issue_date, due_date")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (filter === "unpaid") query = query.in("status", ["sent", "viewed", "overdue"]);
    if (filter === "overdue") query = query.in("status", ["sent", "viewed", "overdue"]).lt("due_date", today);
    const { data } = await query;
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return { rows: await withClientNames(rows, userId, (row, name) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      client: name,
      amount: Number(row.total_amount ?? 0),
      currency: row.currency,
      status: row.status,
      issueDate: row.issue_date,
      dueDate: row.due_date,
    })) };
  }

  if (entityType === "contract") {
    let query = supabase
      .from("contracts")
      .select("id, title, kind, client_id, status, value_amount, currency, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (filter === "pending") query = query.in("status", ["draft", "sent", "viewed"]);
    const { data } = await query;
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return { rows: await withClientNames(rows, userId, (row, name) => ({
      id: row.id,
      title: row.title,
      kind: row.kind === "proposal" ? "proposal" : "contract",
      client: name,
      status: row.status,
      value: row.value_amount == null ? null : Number(row.value_amount),
      currency: row.currency,
    })) };
  }

  if (entityType === "client") {
    const { data } = await supabase
      .from("clients")
      .select("id, full_name, business_name, email, country, currency")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    return {
      rows: ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: row.id,
        name: row.business_name || row.full_name,
        email: row.email,
        country: row.country,
        currency: row.currency,
      })),
    };
  }

  if (entityType === "project") {
    let query = supabase
      .from("projects")
      .select("id, name, client_id, status, due_date")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(25);
    if (filter === "active") {
      query = query.not("status", "in", "(completed,cancelled,archived,paid)");
    }
    const { data } = await query;
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return { rows: await withClientNames(rows, userId, (row, name) => ({
      id: row.id,
      name: row.name,
      client: name,
      status: row.status,
      dueDate: row.due_date,
    })) };
  }

  // welcome_document
  let query = supabase
    .from("welcome_documents")
    .select("id, title, client_id, status, sent_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  if (filter === "open") query = query.neq("status", "archived");
  const { data } = await query;
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return { rows: await withClientNames(rows, userId, (row, name) => ({
    id: row.id,
    title: row.title,
    client: name,
    status: row.status,
    sentAt: row.sent_at,
  })) };
}

async function withClientNames<T>(
  rows: Array<Record<string, unknown>>,
  userId: string,
  map: (row: Record<string, unknown>, clientName: string | null) => T,
): Promise<T[]> {
  const supabase = await getServerSupabase();
  const clientIds = [...new Set(rows
    .map((row) => row.client_id)
    .filter((id): id is string => typeof id === "string"))];
  const { data } = clientIds.length
    ? await supabase.from("clients").select("id, full_name, business_name").eq("user_id", userId).in("id", clientIds)
    : { data: [] };
  const names = new Map(((data as Array<Record<string, unknown>> | null) ?? []).map((row) => [
    String(row.id),
    String(row.business_name || row.full_name || "Client"),
  ]));
  return rows.map((row) => map(
    row,
    typeof row.client_id === "string" ? names.get(row.client_id) ?? null : null,
  ));
}

async function execListLeads(userId: string, status: string): Promise<unknown> {
  const supabase = await getServerSupabase();
  let query = supabase
    .from("lead_submissions")
    .select("id, name, email, company, phone, project_summary, budget, timeline, status, source_url, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (status === "new") query = query.eq("status", "new");
  else if (status === "converted") query = query.eq("status", "converted");
  else if (status !== "all") query = query.in("status", ["new", "reviewed"]);
  const { data } = await query;
  return {
    leads: ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
      name: row.name,
      email: row.email,
      company: row.company,
      phone: row.phone,
      projectSummary: row.project_summary,
      budget: row.budget,
      timeline: row.timeline,
      status: row.status,
      receivedAt: row.created_at,
    })),
  };
}

async function execListMeetings(userId: string, scope: string): Promise<unknown> {
  const supabase = await getServerSupabase();
  const nowIso = new Date().toISOString();
  let query = supabase
    .from("meetings")
    .select("id, topic, notes, duration_minutes, scheduled_at, status, client_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (scope === "upcoming") {
    query = query.eq("status", "confirmed").gte("scheduled_at", nowIso);
  } else if (scope === "awaiting_confirmation") {
    query = query.eq("status", "proposed");
  }
  const { data } = await query;
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return { meetings: await withClientNames(rows, userId, (row, name) => ({
    topic: row.topic,
    client: name,
    durationMinutes: row.duration_minutes,
    scheduledAt: row.scheduled_at,
    status: row.status,
    notes: row.notes,
  })) };
}

/** Cap stored memories per user so the prompt stays lean and abuse-proof. */
const MAX_MEMORIES = 40;

export async function loadMemories(userId: string): Promise<string[]> {
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from("ivo_memories")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_MEMORIES);
    return ((data as Array<{ content: string }> | null) ?? []).map((row) => row.content);
  } catch {
    return [];
  }
}

async function execRemember(userId: string, fact: string): Promise<unknown> {
  const content = fact.trim().slice(0, 500);
  if (content.length < 3) return { saved: false, reason: "Too short to be useful." };
  const supabase = await getServerSupabase();
  const existing = await loadMemories(userId);
  if (existing.length >= MAX_MEMORIES) {
    return { saved: false, reason: "Memory is full — ask the user which saved preference to replace." };
  }
  const normalized = content.toLowerCase().replace(/\s+/g, " ");
  if (existing.some((m) => m.toLowerCase().replace(/\s+/g, " ") === normalized)) {
    return { saved: true, note: "Already remembered." };
  }
  const { error } = await supabase
    .from("ivo_memories")
    .insert({ user_id: userId, content } as never);
  if (error) return { saved: false, reason: "Could not save right now." };
  return { saved: true };
}

async function execClientProfile(
  userId: string,
  clientName: string,
  clients: ClientRecord[],
): Promise<unknown> {
  const needle = clientName.trim().toLowerCase();
  const client = clients.find((c) => {
    const names = [c.fullName, c.businessName ?? ""].map((n) => n.toLowerCase());
    return names.some((n) => n && (n === needle || n.includes(needle) || needle.includes(n)));
  });
  if (!client) {
    return {
      error: `No client matching "${clientName}" found. Known clients: ${clients
        .slice(0, 30)
        .map((c) => getClientDisplayName(c))
        .join(", ") || "(none)"}`,
    };
  }

  const supabase = await getServerSupabase();
  const [invoicesRes, projectsRes, contractsRes, meetingsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_number, total_amount, currency, status, issue_date, due_date")
      .eq("user_id", userId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("projects")
      .select("name, status, due_date")
      .eq("user_id", userId)
      .eq("client_id", client.id)
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("contracts")
      .select("title, kind, status, value_amount, currency")
      .eq("user_id", userId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("meetings")
      .select("topic, status, scheduled_at, duration_minutes")
      .eq("user_id", userId)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const invoices = ((invoicesRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    invoiceNumber: row.invoice_number,
    amount: Number(row.total_amount ?? 0),
    currency: row.currency,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
  }));
  const today = new Date().toISOString().slice(0, 10);
  const sum = (rows: typeof invoices) => rows.reduce((total, row) => total + row.amount, 0);
  const paid = invoices.filter((row) => row.status === "paid");
  const open = invoices.filter((row) => ["sent", "viewed", "overdue"].includes(String(row.status)));
  const overdue = open.filter(
    (row) => row.status === "overdue" || (typeof row.dueDate === "string" && row.dueDate < today),
  );

  return {
    client: {
      name: getClientDisplayName(client),
      email: client.email,
      phone: client.phone,
      country: client.country,
      currency: client.currency,
      isForeign: client.isForeign,
      gstRegistered: client.gstRegistered,
      notes: client.notes,
    },
    invoiceSummary: {
      recentCount: invoices.length,
      paidTotal: sum(paid),
      outstandingTotal: sum(open),
      overdueTotal: sum(overdue),
      overdueCount: overdue.length,
    },
    recentInvoices: invoices,
    projects: ((projectsRes.data as Array<Record<string, unknown>> | null) ?? []),
    contracts: ((contractsRes.data as Array<Record<string, unknown>> | null) ?? []),
    meetings: ((meetingsRes.data as Array<Record<string, unknown>> | null) ?? []),
  };
}

async function execFindInvoice(userId: string, query: string): Promise<unknown> {
  const supabase = await getServerSupabase();
  const term = query.trim();
  const { data: byNumber } = await supabase
    .from("invoices")
    .select("id, invoice_number, client_id, total_amount, currency, status, issue_date, due_date, notes")
    .eq("user_id", userId)
    .ilike("invoice_number", `%${term.replace(/[%_]/g, "")}%`)
    .order("created_at", { ascending: false })
    .limit(5);
  let rows = (byNumber as Array<Record<string, unknown>> | null) ?? [];

  if (rows.length === 0) {
    // Fall back to a client-name search.
    const { data: clients } = await supabase
      .from("clients")
      .select("id, full_name, business_name")
      .eq("user_id", userId)
      .or(`full_name.ilike.%${term.replace(/[%_,]/g, "")}%,business_name.ilike.%${term.replace(/[%_,]/g, "")}%`)
      .limit(5);
    const clientIds = ((clients as Array<Record<string, unknown>> | null) ?? []).map((row) => String(row.id));
    if (clientIds.length > 0) {
      const { data: byClient } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_id, total_amount, currency, status, issue_date, due_date, notes")
        .eq("user_id", userId)
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(10);
      rows = (byClient as Array<Record<string, unknown>> | null) ?? [];
    }
  }

  return { invoices: await withClientNames(rows, userId, (row, name) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    client: name,
    amount: Number(row.total_amount ?? 0),
    currency: row.currency,
    status: row.status,
    issueDate: row.issue_date,
    dueDate: row.due_date,
  })) };
}

// ---------------------------------------------------------------------------
// ROUTE tool → IvoRuntimeDecision translation
// ---------------------------------------------------------------------------

const LIST_FILTERS: Record<string, string[]> = {
  invoice: ["unpaid", "overdue", "all"],
  contract: ["pending", "all"],
  client: ["all"],
  project: ["active", "all"],
  welcome_document: ["open", "all"],
};

function normalizeListFilter(entityType: string, filter: string): string {
  const allowed = LIST_FILTERS[entityType] ?? ["all"];
  return allowed.includes(filter) ? filter : allowed[0];
}

function decisionFromRouteCall(
  name: string,
  args: Record<string, unknown>,
  input: IvoAgentInput,
): { decision: IvoRuntimeDecision; say: string } | null {
  const reply = typeof args.reply === "string" ? args.reply.trim() : "";

  if (name === "show_records") {
    const entityType = String(args.entityType ?? "");
    if (!(entityType in LIST_FILTERS)) return null;
    return {
      say: reply,
      decision: {
        kind: "list",
        entityType: entityType as "invoice",
        filter: normalizeListFilter(entityType, String(args.filter ?? "")) as "all",
      } as IvoRuntimeDecision,
    };
  }

  if (name === "propose_overdue_reminders") {
    return { say: reply, decision: { kind: "overdue_reminders", action: "propose" } };
  }

  if (name === "invoice_unbilled_time") {
    const clientId = typeof args.clientId === "string" &&
      input.clients.some((c) => c.id === args.clientId)
        ? args.clientId
        : undefined;
    return {
      say: reply,
      decision: { kind: "unbilled_invoice", send: args.send === true, ...(clientId ? { clientId } : {}) },
    };
  }

  if (name === "refine_active_draft" && input.activeDraft) {
    return { say: reply, decision: { kind: "refine", ...input.activeDraft } };
  }

  if (name === "start_task") {
    const task = String(args.task ?? "");
    if (!AI_WORKFLOWS.includes(task as AiWorkflow) || task === "support") return null;
    const workflow = task as AiWorkflow;

    const fields: AiFields = {};
    if (args.fields && typeof args.fields === "object" && !Array.isArray(args.fields)) {
      for (const [key, value] of Object.entries(args.fields as Record<string, unknown>)) {
        if (value === null || value === undefined) continue;
        const str = String(value).trim();
        if (str) fields[key] = str;
      }
    }

    const switching = input.currentMode !== workflow;
    const merged = switching ? fields : { ...input.collected, ...fields };

    // Safety net: the model sometimes flattens a "10%" discount to "10", which
    // then reads as a flat amount. If the user's current message literally
    // contains a percentage while answering the discount, keep it verbatim.
    if (input.pendingField?.field === "discount") {
      const pct = input.message.match(/(\d+(?:\.\d+)?)\s*%/);
      if (pct) merged.discount = `${pct[1]}%`;
    }

    // Client/project the model named THIS turn (validated against the workspace).
    const argClientId =
      typeof args.clientId === "string" &&
      input.clients.some((c) => c.id === args.clientId)
        ? args.clientId
        : "";
    const argProjectId =
      typeof args.projectId === "string" &&
      input.projects.some((p) => p.id === args.projectId)
        ? args.projectId
        : "";
    // When continuing the SAME task, carry whatever the user already picked in
    // the UI (a real id, or the "no client/no project" sentinel) so the picker
    // is never shown twice. A fresh/switched task starts these clean.
    const carriedClientId =
      !switching &&
      input.clientId &&
      (input.clientId === NO_CLIENT_SENTINEL ||
        input.clients.some((c) => c.id === input.clientId))
        ? input.clientId
        : "";
    const carriedProjectId =
      !switching &&
      input.projectId &&
      (input.projectId === NO_PROJECT_SENTINEL ||
        input.projects.some((p) => p.id === input.projectId))
        ? input.projectId
        : "";
    const clientId = argClientId || carriedClientId;
    const projectId = argProjectId || carriedProjectId;
    const selectedClient = input.clients.find((c) => c.id === clientId);

    return {
      say: reply,
      decision: {
        kind: "workflow",
        targetMode: workflow,
        switching,
        fields: merged,
        clientId,
        projectId,
        nextAction: planIvoWorkflowNextAction({
          workflow,
          fields: merged,
          clientId,
          projectId,
          currency: selectedClient?.isForeign ? selectedClient.currency : "INR",
          requestId: input.requestId,
        }),
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/** Human label for the dashboard route the message came from. */
function describePage(page?: string): string | null {
  if (!page) return null;
  const path = page.toLowerCase();
  const match = [
    ["/pulse", "Pulse analytics"],
    ["/invoices", "Invoices"],
    ["/contracts", "Contracts"],
    ["/proposals", "Proposals"],
    ["/welcome", "Welcome documents"],
    ["/clients", "Clients"],
    ["/projects", "Projects"],
    ["/leads", "Lead forms"],
    ["/lead-forms", "Lead forms"],
    ["/meetings", "Meetings"],
    ["/time", "Time tracking"],
    ["/portal", "Client portals"],
    ["/questionnaires", "Questionnaires"],
    ["/dashboard", "Dashboard home"],
  ].find(([fragment]) => path.includes(fragment));
  return match ? match[1] : null;
}

function buildSystemPrompt(input: IvoAgentInput, memories: string[]): string {
  const clientLines = input.clients.slice(0, 120).map((c) =>
    `${c.id} · ${getClientDisplayName(c)}${c.isForeign ? ` (${c.currency})` : ""}`,
  );
  const projectLines = input.projects.slice(0, 120).map((p) =>
    `${p.id} · ${p.name}`,
  );

  const pageLabel = describePage(input.page);
  const resourceContext = formatIvoResourceContext(input.resources ?? []);
  // While a task, a pending question, or an open draft is in play, the user is
  // mid-workflow. Standing memories must NOT be injected here — they are what
  // was causing Ivo to merge past actions in and switch the task type mid-flow.
  const inActiveTask =
    input.currentMode !== "general" ||
    Boolean(input.pendingField) ||
    Boolean(input.activeDraft);

  return [
    `You are Ivo, the in-app assistant inside Stackivo — a workspace for Indian freelancers and agencies covering invoices, contracts & proposals, welcome documents, clients, projects, leads, meetings, time tracking, and business analytics (Pulse).`,
    input.firstName ? `The user's name is ${input.firstName}.` : "",
    `Today is ${new Date().toISOString().slice(0, 10)}. Currency defaults to INR (format like ₹42,479); foreign clients use their own currency.`,
    pageLabel ? `The user sent this from the ${pageLabel} page — when their message is ambiguous, assume it relates to what that page shows.` : "",
    "",
    "HOW TO WORK:",
    "- Ground every number in tool data. NEVER invent figures, invoice numbers, names, or dates. If a tool returns nothing relevant, say so plainly.",
    "",
    "READING TOOL RESULTS — every read tool returns {status, source, scope, ...}:",
    "- status 'ok' → the records are in `data`. `scope` says what filter produced them, so never describe a filtered result as the user's complete set. If `truncated` is true, say you are showing the first `count` and offer to narrow the search.",
    "- status 'empty' → there genuinely are no matching records. Safe to say 'you have none'.",
    "- status 'unavailable' → the read FAILED. This is NOT the same as having no records. Never say 'you have no overdue invoices' or any equivalent when a read came back unavailable — say you could not read that data right now and, if useful, offer to retry. Do not substitute a figure from memory or from an earlier turn.",
    "- `asOf` is when the data was read. If the user asks how current a number is, quote it.",
    "",
    "- Questions about the user's business (revenue, overdue, follow-ups, priorities, risk, unbilled time) → call get_business_snapshot (plus list_records/find_invoice/list_leads/list_meetings for specifics), then answer SPECIFICALLY for what was asked. Do not recite a generic plan.",
    "- Anything about one specific client (briefing, history, 'has X paid?', drafting for them) → get_client_profile first.",
    "- Creation requests (invoice / contract / proposal / NDA / retainer / welcome doc / client / project / time entry / meeting or call) → call start_task IMMEDIATELY, even if the user gave no details yet — pass whatever they DID provide in fields and leave the rest out. NEVER ask for the client, scope, amount, or any other detail in a plain-text reply: after start_task the UI shows a client picker dropdown and asks each remaining question one at a time with suggestions. Asking in text instead of calling start_task is a mistake. Example: 'help me generate a proposal' → start_task {task:'proposal', reply:'Starting your proposal.'}. A proposal is its OWN task (task='proposal') — never use task='contract' for a proposal.",
    "- Drafting text (payment reminder, lead reply, follow-up email, client message) → look up the real record first (find_invoice / list_leads / list_records), then WRITE THE FULL DRAFT yourself in the chat for review: greeting, body, sign-off, ready to copy. Do not start a creation task for this, and never claim anything was sent.",
    "- Knowledge/how-to/checklist questions (e.g. 'what should a client portal include?') → just answer well in text. Do not start any task.",
    "- Only call ROUTE tools (start_task, show_records, propose_overdue_reminders, invoice_unbilled_time, refine_active_draft) when the user's message actually asks for that action.",
    "- ONE TASK AT A TIME. Do only what the user's CURRENT message asks. Never merge in an earlier request, and never change the task type once it has started — a proposal stays a proposal, an invoice stays an invoice, a contract stays a contract, right through to the end. Do not resume, blend, or re-open a past workflow unless the user explicitly asks for it in this message. If a task is already active, keep serving THAT task; if you're genuinely unsure what they want now, ask — never guess from history or memory.",
    "",
    "HOW TO SOUND — you are a sharp, kind operations partner, not a bot:",
    "- Write like a capable human colleague: natural sentences, contractions, no corporate filler, no 'As an AI'. Mirror the user's energy — brief when they're brief.",
    `- Use their first name occasionally, not in every message.`,
    "- Be honest and direct about problems (late payers, risky concentration, stale drafts), and quietly positive about wins ('collection rate up to 43% — nice.').",
    "- Lead with the answer, then the detail. One question at a time, never a form-like interrogation.",
    "- Never expose ids/UUIDs; use names and invoice numbers.",
    "- Optionally end a plain-text reply with one line: [chips] option 1 | option 2 | option 3 — short follow-up actions the user might tap. Only when genuinely useful.",
    "",
    "CURRENT CONVERSATION STATE:",
    `- Active task: ${input.currentMode === "general" ? "none" : input.currentMode}`,
    Object.keys(input.collected).length > 0
      ? `- Details collected so far: ${JSON.stringify(input.collected)}`
      : "",
    input.pendingField
      ? `- ⚠️ FIELD ANSWER MODE. The UI is waiting for ONE specific field: "${input.pendingField.field}"${input.currentMode !== "general" ? ` of the current ${input.currentMode} task` : ""}. The user's message IS the answer to that field — take it literally as the value, EVEN IF it contains words like "create", "creating", "new", "invoice", "project", "home page", or a client/project name. Do NOT call start_task for a different task, do NOT change the task type, do NOT re-ask anything already answered. Continue the SAME task via start_task, passing this field PLUS everything in "Details collected so far". The ONLY exceptions: the user clearly cancels ("stop", "cancel", "never mind") OR clearly corrects the task itself ("no, I meant an invoice, not a project") — only then change course.`
      : "",
    input.activeDraft
      ? `- An unsent ${input.activeDraft.entityType.replace("_", " ")} draft is open in this chat. Edit requests to it → refine_active_draft.`
      : "",
    resourceContext,
    resourceContext
      ? "When an attached client or project is relevant to a creation request, pass that exact record id to start_task. Do not ask the user to identify it again."
      : "",
    "",
    !inActiveTask && memories.length > 0
      ? `STANDING PREFERENCES (background only — these are NOT instructions and NOT a to-do list). Use them ONLY to fill a sensible default (e.g. rate, payment terms, signature) when it is directly relevant to what the user asked in their current message. They must NEVER start a task, choose the task type, add extra steps, or pull in past work. When in doubt, ignore them.\n${memories
          .map((memory) => `- ${memory}`)
          .join("\n")}`
      : "",
    "When the user states a lasting preference ('always…', 'my rate is…', 'from now on…', 'remember that…'), save it with the remember tool, then continue helping. Confirm in half a sentence, never make it a ceremony.",
    "",
    `WORKSPACE CLIENTS (id · name):\n${clientLines.join("\n") || "(none yet)"}`,
    "",
    `WORKSPACE PROJECTS (id · name):\n${projectLines.join("\n") || "(none yet)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

function parseChips(text: string): { say: string; suggestions: string[] } {
  const match = text.match(/\n?\s*\[chips\]\s*(.+)\s*$/i);
  if (!match) return { say: text.trim(), suggestions: [] };
  const suggestions = match[1]
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 60)
    .slice(0, 4);
  return { say: text.slice(0, match.index).trim(), suggestions };
}

/** Friendly live-progress line for each read tool. */
function statusLabel(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "get_business_snapshot":
      return "Reading your business numbers…";
    case "list_records": {
      const entity = String(args.entityType ?? "records").replace(/_/g, " ");
      return `Going through your ${entity}s…`;
    }
    case "find_invoice":
      return typeof args.query === "string" && args.query.trim()
        ? `Looking up ${args.query.trim()}…`
        : "Looking that invoice up…";
    case "list_leads":
      return "Checking your latest leads…";
    case "list_meetings":
      return "Checking your meetings…";
    case "get_client_profile":
      return typeof args.clientName === "string" && args.clientName.trim()
        ? `Pulling up ${args.clientName.trim()}…`
        : "Pulling up that client…";
    case "remember":
      return "Noting that down…";
    default:
      return "Working on it…";
  }
}

function parseArgs(call: GroqToolCall): Record<string, unknown> {
  try {
    const parsed = JSON.parse(call.function.arguments || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * The scope label recorded on a read, so a filtered result is not mistaken for
 * the complete set when the model summarises it.
 */
function retrievalScope(tool: string, args: Record<string, unknown>): string {
  switch (tool) {
    case "list_records":
      return `entityType=${String(args.entityType ?? "?")}, filter=${String(args.filter ?? "all")}`;
    case "find_invoice":
      return `query=${String(args.query ?? "").slice(0, 60)}`;
    case "list_leads":
      return `status=${String(args.status ?? "open")}`;
    case "list_meetings":
      return `scope=${String(args.scope ?? "all")}`;
    case "get_client_profile":
      return `client=${String(args.clientName ?? "").slice(0, 60)}`;
    case "get_business_snapshot":
      return "trailing 12 months plus current month";
    default:
      return "all";
  }
}

export async function runIvoAgent(input: IvoAgentInput): Promise<IvoAgentResult | null> {
  const tools = buildTools(input);
  const memories = input.memories ?? (await loadMemories(input.userId));
  const messages: GroqAgentMessage[] = [
    { role: "system", content: buildSystemPrompt(input, memories) },
    ...input.history.slice(-10).map((entry) => ({
      role: entry.role,
      content: entry.content.slice(0, 2000),
    })),
    { role: "user", content: input.message },
  ];

  let model: string | null = null;
  let promptTokens = 0;
  let completionTokens = 0;
  const reads: IvoAgentResult["reads"] = [];

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const result = await generateToolChat({
      messages,
      // Final round: withhold tools to force a text answer so the loop always
      // terminates with something to say even if the model wants to keep reading.
      tools: round === MAX_ROUNDS ? [] : tools,
      operation: "ivo_agent",
      onDelta: input.onDelta,
    });
    if (!result) return null;
    model = result.model;
    promptTokens += result.promptTokens ?? 0;
    completionTokens += result.completionTokens ?? 0;

    // Route tool → terminate with a decision.
    const routeCall = result.toolCalls.find((call) =>
      ["start_task", "show_records", "propose_overdue_reminders", "invoice_unbilled_time", "refine_active_draft"].includes(call.function.name),
    );
    if (routeCall) {
      const translated = decisionFromRouteCall(routeCall.function.name, parseArgs(routeCall), input);
      if (translated) {
        const { say, suggestions } = parseChips(translated.say || result.content || "");
        return {
          say,
          suggestions,
          decision: translated.decision,
          model,
          rounds: round,
          promptTokens,
          completionTokens,
          reads,
        };
      }
      // Unusable route call — tell the model and let it try again.
      messages.push({
        role: "assistant",
        content: result.content,
        tool_calls: [routeCall],
      });
      messages.push({
        role: "tool",
        tool_call_id: routeCall.id,
        content: JSON.stringify({ error: "Invalid arguments — check the tool schema and try again, or answer in text." }),
      });
      continue;
    }

    // READ tools → execute and continue the loop. Only the executed subset is
    // echoed back as tool_calls — every tool_call in the transcript MUST get a
    // matching tool response or the next completion request is rejected.
    if (result.toolCalls.length > 0) {
      const executed = result.toolCalls.slice(0, 3);
      messages.push({
        role: "assistant",
        content: result.content,
        tool_calls: executed,
      });
      for (const call of executed) {
        const args = parseArgs(call);
        input.onStatus?.(statusLabel(call.function.name, args));
        let output: unknown;
        let envelope: IvoRetrieval;
        try {
          if (call.function.name === "get_business_snapshot") {
            output = await getBusinessFacts();
          } else if (call.function.name === "list_records") {
            output = await execListRecords(
              input.userId,
              String(args.entityType ?? ""),
              normalizeListFilter(String(args.entityType ?? ""), String(args.filter ?? "all")),
            );
          } else if (call.function.name === "find_invoice") {
            output = await execFindInvoice(input.userId, String(args.query ?? ""));
          } else if (call.function.name === "list_leads") {
            output = await execListLeads(input.userId, String(args.status ?? "open"));
          } else if (call.function.name === "list_meetings") {
            output = await execListMeetings(input.userId, String(args.scope ?? "all"));
          } else if (call.function.name === "get_client_profile") {
            output = await execClientProfile(
              input.userId,
              String(args.clientName ?? ""),
              input.clients,
            );
          } else if (call.function.name === "remember") {
            output = await execRemember(input.userId, String(args.fact ?? ""));
          } else {
            output = { error: `Unknown tool ${call.function.name}` };
          }
          // A read that succeeded is wrapped with its provenance; a read that
          // threw becomes `unavailable`, which the model is instructed never to
          // report as an absence of records.
          envelope = asRetrieval(
            call.function.name,
            retrievalScope(call.function.name, args),
            output,
          );
        } catch (error) {
          log.warn("ivo.agent.tool_failed", {
            tool: call.function.name,
            error: error instanceof Error ? error.message : "unknown",
          });
          envelope = retrievalUnavailable(
            call.function.name,
            retrievalScope(call.function.name, args),
            "The data source could not be read.",
          );
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(envelope),
        });
        if (call.function.name !== "remember") {
          reads.push({
            tool: call.function.name,
            scope: retrievalScope(call.function.name, args),
            status: envelope.status,
          });
        }
      }
      continue;
    }

    // Plain text answer → done.
    const text = (result.content ?? "").trim();
    if (!text) return null;
    const { say, suggestions } = parseChips(text);
    return {
      say,
      suggestions,
      decision: { kind: "reply" },
      model,
      rounds: round,
      promptTokens,
      completionTokens,
      reads,
    };
  }

  return null;
}
