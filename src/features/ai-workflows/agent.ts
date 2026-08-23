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
import { isUnbilledTimeInvoiceAction, normalizeSkipFieldValues } from "./runtime-planner";
import type { AiFields, AiWorkflow } from "./types";
import { AI_WORKFLOWS, NO_CLIENT_SENTINEL, NO_PROJECT_SENTINEL } from "./types";
import type { IvoMode, IvoRuntimeDecision } from "./conversation-types";
import type { IvoResolvedResource } from "./resource-mentions";
import { buildSystemPrompt } from "./agent-prompt";

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
  activeDraft?: { entityType: "invoice" | "contract" | "questionnaire" | "welcome_document"; entityId: string };
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
          "Read the user's real business numbers: revenue (12m/this month), outstanding & overdue invoices with aging, collection rate, avg days to pay, top clients by revenue with concentration %, revenue by project, tracked/billable hours, unbilled time grouped by client and project with value/rate/date range, and GST totals. ALWAYS call this before answering any question about the user's numbers, priorities, follow-ups, risk, or business health. Never invent figures.",
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
              enum: ["invoice", "contract", "proposal", "client", "project", "welcome_document"],
            },
            filter: {
              type: "string",
              enum: ["all", "unpaid", "overdue", "pending", "active", "open"],
              description:
                "invoice: unpaid|overdue|all · contract: pending|all · proposal: pending|all · project: active|all · welcome_document: open|all · client: all",
            },
          },
          required: ["entityType", "filter"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "assess_portal_candidates",
        description:
          "Compare every client with the user's existing client portals and current shared-work signals. Returns whether each client already has an active portal plus counts for active projects, open invoices, pending contracts/proposals, upcoming meetings, and welcome documents. ALWAYS use this for 'who needs a portal?', portal-gap reviews, or recommendations about which client should receive a portal next. Analyse the result and answer in text; do not render the generic client directory.",
        parameters: { type: "object", properties: {}, required: [] },
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
          "Start (or continue) a guided creation task: draft an invoice, a proposal (task='proposal'), a contract/NDA/retainer (task='contract'), a welcome document, create a client, project, client portal (task='portal'), or time entry, or schedule a meeting/call (task='meeting'). Pass every detail the user already gave in `fields` so they are never asked twice. The UI then walks the user through anything missing with pickers. A proposal is its OWN task — use task='proposal', NOT task='contract'. A portal is its OWN task — never create a project named Client Portal.",
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
              enum: ["invoice", "contract", "proposal", "client", "project", "welcome_document"],
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
          "Create a draft invoice from the user's unbilled tracked time. Use only for a direct creation command such as 'Create an invoice for my unbilled time' or 'Bill my unbilled time'. Never use for advisory questions such as 'What unbilled time should I invoice?' or 'Which hours are ready to bill?' — use get_business_snapshot and answer in text instead.",
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

  // A portal-gap review is analysis, not a request to browse the client
  // directory. Withholding show_records here prevents the model from ending
  // the turn with a generic list before it has read the portal evidence.
  return tools.filter((tool) => {
    if (isPortalPlanningRequest(input.message) && tool.function.name === "show_records") {
      return false;
    }
    // Groq cannot accidentally turn a read-only review into a draft when the
    // mutation tool is absent. The explicit Time-page billing button still
    // uses wording that passes isUnbilledTimeInvoiceAction.
    if (
      /\bunbilled\b/i.test(input.message) &&
      !isUnbilledTimeInvoiceAction(input.message) &&
      tool.function.name === "invoice_unbilled_time"
    ) {
      return false;
    }
    return true;
  });
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

  if (entityType === "proposal") {
    let query = supabase
      .from("proposals")
      .select("id, title, client_id, status, total_amount, currency, valid_until, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (filter === "pending") query = query.in("status", ["draft", "sent", "viewed"]);
    const { data } = await query;
    const rows = (data as Array<Record<string, unknown>> | null) ?? [];
    return { rows: await withClientNames(rows, userId, (row, name) => ({
      id: row.id,
      title: row.title,
      client: name,
      status: row.status,
      total: Number(row.total_amount ?? 0),
      currency: row.currency,
      validUntil: row.valid_until,
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

function isPortalPlanningRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /\bportals?\b/.test(normalized) &&
    /\b(who|which|needs?|should|recommend|next|gap|review|compare)\b/.test(normalized) &&
    /\b(clients?|customers?)\b/.test(normalized)
  );
}

async function execAssessPortalCandidates(userId: string): Promise<unknown> {
  const supabase = await getServerSupabase();
  const nowIso = new Date().toISOString();
  const [clientsRes, portalsRes, projectsRes, invoicesRes, contractsRes, proposalsRes, meetingsRes, welcomeRes] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, full_name, business_name, email")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("portals")
        .select("id, name, client_id, status")
        .eq("owner_user_id", userId)
        .is("deleted_at", null)
        .limit(200),
      supabase
        .from("projects")
        .select("client_id, status")
        .eq("user_id", userId)
        .limit(500),
      supabase
        .from("invoices")
        .select("client_id, status")
        .eq("user_id", userId)
        .limit(500),
      supabase
        .from("contracts")
        .select("client_id, status")
        .eq("user_id", userId)
        .limit(500),
      supabase
        .from("proposals")
        .select("client_id, status")
        .eq("user_id", userId)
        .limit(500),
      supabase
        .from("meetings")
        .select("client_id, status, scheduled_at")
        .eq("user_id", userId)
        .limit(500),
      supabase
        .from("welcome_documents")
        .select("client_id, status")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .limit(500),
    ]);

  const clients = (clientsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const portals = (portalsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const projects = (projectsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const invoices = (invoicesRes.data as Array<Record<string, unknown>> | null) ?? [];
  const contracts = (contractsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const proposals = (proposalsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const meetings = (meetingsRes.data as Array<Record<string, unknown>> | null) ?? [];
  const welcomeDocuments = (welcomeRes.data as Array<Record<string, unknown>> | null) ?? [];
  const countFor = (
    rows: Array<Record<string, unknown>>,
    clientId: string,
    matches: (row: Record<string, unknown>) => boolean,
  ) => rows.filter((row) => row.client_id === clientId && matches(row)).length;

  const candidates = clients.map((client) => {
    const clientId = String(client.id);
    const activePortal = portals.find(
      (portal) => portal.client_id === clientId && portal.status === "active",
    );
    const signals = {
      activeProjects: countFor(
        projects,
        clientId,
        (row) => !["completed", "cancelled", "archived", "paid"].includes(String(row.status)),
      ),
      openInvoices: countFor(
        invoices,
        clientId,
        (row) => ["sent", "viewed", "overdue", "partially_paid"].includes(String(row.status)),
      ),
      pendingContracts: countFor(
        contracts,
        clientId,
        (row) => ["draft", "sent", "viewed"].includes(String(row.status)),
      ),
      pendingProposals: countFor(
        proposals,
        clientId,
        (row) => ["draft", "sent", "viewed"].includes(String(row.status)),
      ),
      upcomingMeetings: countFor(
        meetings,
        clientId,
        (row) => row.status === "proposed" ||
          (row.status === "confirmed" && typeof row.scheduled_at === "string" && row.scheduled_at >= nowIso),
      ),
      welcomeDocuments: countFor(
        welcomeDocuments,
        clientId,
        (row) => row.status !== "archived",
      ),
    };
    const priorityScore =
      signals.activeProjects * 4 +
      signals.openInvoices * 3 +
      signals.pendingContracts * 2 +
      signals.pendingProposals * 2 +
      signals.upcomingMeetings * 2 +
      signals.welcomeDocuments;
    return {
      clientId,
      client: String(client.business_name || client.full_name || "Client"),
      hasEmail: Boolean(client.email),
      hasActivePortal: Boolean(activePortal),
      portalName: activePortal ? String(activePortal.name || "Client portal") : null,
      priorityScore,
      signals,
    };
  });

  return {
    summary: {
      clients: clients.length,
      portals: portals.length,
      activePortals: portals.filter((portal) => portal.status === "active").length,
      clientsWithoutActivePortal: candidates.filter((candidate) => !candidate.hasActivePortal).length,
    },
    candidates: candidates.sort((a, b) => {
      if (a.hasActivePortal !== b.hasActivePortal) return a.hasActivePortal ? 1 : -1;
      return b.priorityScore - a.priorityScore;
    }),
    rankingNote:
      "Higher scores reflect more active shared work. Recommend only clients without an active portal, explain the strongest real signals, and say when there is not enough activity to justify one yet.",
  };
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
  const [invoicesRes, projectsRes, contractsRes, proposalsRes, meetingsRes] = await Promise.all([
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
      .from("proposals")
      .select("title, status, total_amount, currency, valid_until")
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
  const open = invoices.filter((row) => ["sent", "viewed", "overdue", "partially_paid"].includes(String(row.status)));
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
    proposals: ((proposalsRes.data as Array<Record<string, unknown>> | null) ?? []),
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
  proposal: ["pending", "all"],
  client: ["all"],
  project: ["active", "all"],
  welcome_document: ["open", "all"],
};

function normalizeListFilter(entityType: string, filter: string): string {
  const allowed = LIST_FILTERS[entityType] ?? ["all"];
  return allowed.includes(filter) ? filter : allowed[0];
}

/**
 * Executes one agent READ tool and wraps the result in its retrieval envelope.
 * A read that throws becomes `unavailable` rather than an error: the model is
 * instructed to treat unavailable as "could not read right now", never as an
 * absence of records.
 */
async function executeReadTool(
  name: string,
  args: Record<string, unknown>,
  input: IvoAgentInput,
): Promise<IvoRetrieval> {
  input.onStatus?.(statusLabel(name, args));
  try {
    let output: unknown;
    if (name === "get_business_snapshot") {
      output = await getBusinessFacts();
    } else if (name === "assess_portal_candidates") {
      output = await execAssessPortalCandidates(input.userId);
    } else if (name === "list_records") {
      output = await execListRecords(
        input.userId,
        String(args.entityType ?? ""),
        normalizeListFilter(String(args.entityType ?? ""), String(args.filter ?? "all")),
      );
    } else if (name === "find_invoice") {
      output = await execFindInvoice(input.userId, String(args.query ?? ""));
    } else if (name === "list_leads") {
      output = await execListLeads(input.userId, String(args.status ?? "open"));
    } else if (name === "list_meetings") {
      output = await execListMeetings(input.userId, String(args.scope ?? "all"));
    } else if (name === "get_client_profile") {
      output = await execClientProfile(
        input.userId,
        String(args.clientName ?? ""),
        input.clients,
      );
    } else if (name === "remember") {
      output = await execRemember(input.userId, String(args.fact ?? ""));
    } else {
      output = { error: `Unknown tool ${name}` };
    }
    return asRetrieval(name, retrievalScope(name, args), output);
  } catch (error) {
    log.warn("ivo.agent.tool_failed", {
      tool: name,
      error: error instanceof Error ? error.message : "unknown",
    });
    return retrievalUnavailable(
      name,
      retrievalScope(name, args),
      "The data source could not be read.",
    );
  }
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
    const merged = normalizeSkipFieldValues(
      switching ? fields : { ...input.collected, ...fields },
    );

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
    case "assess_portal_candidates":
      return "Comparing clients with their portal activity…";
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
    case "assess_portal_candidates":
      return "all owned clients, portals, and current shared-work signals";
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
      // Reads are independent owner-scoped queries, so they run concurrently;
      // a round that asks for snapshot + list + profile pays one read latency
      // instead of three. Tool messages are appended afterwards in the
      // original call order so each tool_call stays paired with its response.
      const envelopes = await Promise.all(
        executed.map((call) => executeReadTool(call.function.name, parseArgs(call), input)),
      );
      executed.forEach((call, index) => {
        const args = parseArgs(call);
        const envelope = envelopes[index];
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
      });
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
