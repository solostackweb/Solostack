"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import type { IvoConversationRow, IvoMessageRow, Json } from "@/lib/supabase/types";
import { aiGenerateLimit } from "@/lib/rate-limit";
import { listClients } from "@/features/clients/server";
import { listProjects } from "@/features/projects/server";
import { getUsageSnapshot, getCurrentSubscription } from "@/features/subscription/server";
import { incrementUsage } from "@/features/subscription/usage";
import { effectivePlan } from "@/features/subscription/features";
import { getProfile } from "@/features/profile/server";
import { AI_WORKFLOWS, type AiInterpretation } from "./types";
import { interpretMessageDetailed } from "./nlu";
import { runIvoAgent } from "./agent";
import { ivoRuntimeDecisionSchema, planIvoRuntime } from "./runtime-planner";
import { planIvoWorkflowNextAction } from "./workflow-progress";
import {
  EMPTY_IVO_WORKFLOW_STATE,
  IVO_MODES,
  type IvoConversationSnapshot,
  type IvoMessageBlockReference,
  type IvoMode,
  type IvoResolvedMessageBlock,
  type IvoWorkflowState,
} from "./conversation-types";

const conversationIdSchema = z.string().uuid();
const messageBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("entity_preview"),
    entityType: z.enum(["invoice", "contract", "welcome_document"]),
    entityId: z.string().uuid(),
    variant: z.enum(["draft", "delivery"]),
  }),
  z.object({
    type: z.literal("picker"),
    pickerType: z.enum(["client", "project", "state", "welcome_template"]),
    label: z.string().trim().min(1).max(1000),
    allowSkip: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("entity_list"),
    entityType: z.enum(["invoice", "contract", "client", "project", "welcome_document"]),
    entityIds: z.array(z.string().uuid()).max(20),
  }),
  z.object({
    type: z.literal("entity_result"),
    entityType: z.enum(["client", "project", "time_entry"]),
    entityId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("confirmation"),
    requestId: z.string().trim().min(4).max(100),
  }),
]);
const messageSchema = z.object({
  conversationId: conversationIdSchema,
  clientMessageId: z.string().trim().min(4).max(100),
  role: z.enum(["user", "assistant"]),
  kind: z.enum(["text", "question", "picker", "preview", "confirmation", "error", "result"]).default("text"),
  content: z.string().trim().min(1).max(6000),
  suggestions: z.array(z.string().max(300)).max(10).optional(),
  tip: z.string().max(1000).optional(),
  block: messageBlockSchema.optional(),
});
const pendingFieldSchema = z
  .object({
    field: z.string().min(1).max(100),
    question: z.string().min(1).max(1000),
    placeholder: z.string().max(1000).optional(),
    optional: z.boolean().optional(),
    suggestions: z.array(z.string().max(300)).max(10).optional(),
    tip: z.string().max(1000).optional(),
  })
  .nullable();
const workflowStateSchema = z.object({
  version: z.literal(1),
  mode: z.enum(IVO_MODES),
  collected: z.record(z.string().max(6000)).default({}),
  pendingField: pendingFieldSchema.default(null),
  pendingConfirmation: z.object({
    workflow: z.enum(["client", "project", "time_entry"]),
    tool: z.enum(["client.create", "project.create", "time_entry.create"]),
    fields: z.record(z.string().max(6000)),
    cId: z.string().max(100),
    pId: z.string().max(100),
    toolRequestKey: z.string().trim().min(4).max(100),
    summary: z.object({
      kind: z.enum(["client", "project", "time_entry"]),
      title: z.string().trim().min(1).max(1000),
      lines: z.array(z.tuple([z.string().max(300), z.string().max(1000)])).max(30),
    }),
  }).nullable().default(null),
  pendingProposal: z.enum(["overdue_reminders"]).nullable().default(null),
  clientId: z.string().max(100).default(""),
  projectId: z.string().max(100).default(""),
});
const saveStateSchema = z.object({
  conversationId: conversationIdSchema,
  state: workflowStateSchema,
});
const processMessageSchema = z.object({
  conversationId: conversationIdSchema,
  clientMessageId: z.string().trim().min(4).max(100),
  message: z.string().trim().min(1).max(6000),
  currentWorkflow: z.enum(AI_WORKFLOWS).optional(),
  pendingField: z.object({
    field: z.string().trim().min(1).max(100),
    optional: z.boolean().optional(),
  }).optional(),
  pendingProposal: z.enum(["overdue_reminders"]).optional(),
  activeDraft: z.object({
    entityType: z.enum(["invoice", "contract", "welcome_document"]),
    entityId: z.string().uuid(),
  }).optional(),
  clientId: z.string().max(100).optional(),
  projectId: z.string().max(100).optional(),
  collected: z.record(z.string().max(6000)).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .optional(),
  /** Dashboard route the message was sent from, for page-aware answers. */
  page: z.string().max(200).optional(),
});
const workflowProgressInputSchema = z.object({
  conversationId: conversationIdSchema,
  workflow: z.enum(AI_WORKFLOWS),
  fields: z.record(z.string().max(6000)).default({}),
  clientId: z.string().max(100).default(""),
  projectId: z.string().max(100).default(""),
});

async function requireUser() {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

function parseState(value: Json): IvoWorkflowState {
  const parsed = workflowStateSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_IVO_WORKFLOW_STATE;
}

function parseDocumentSections(value: unknown): Array<{ heading: string; body: string }> {
  try {
    const parsed = JSON.parse(typeof value === "string" ? value : "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((section) => section && typeof section.heading === "string" && typeof section.body === "string")
      .map((section) => ({ heading: section.heading, body: section.body }));
  } catch {
    return [];
  }
}

async function resolveMessageBlock(
  reference: IvoMessageBlockReference,
  userId: string,
  state: IvoWorkflowState,
): Promise<IvoResolvedMessageBlock | undefined> {
  const supabase = await getServerSupabase();

  if (reference.type === "confirmation") {
    const pending = state.pendingConfirmation;
    if (!pending || pending.toolRequestKey !== reference.requestId) return undefined;
    return { ...reference, data: pending.summary as unknown as Json };
  }

  if (reference.type === "picker") {
    const expectedField = reference.pickerType === "client"
      ? "clientId"
      : reference.pickerType === "project"
        ? "projectId"
        : reference.pickerType === "state"
          ? "state"
          : "welcomeTemplate";
    // Completed historical pickers retain their textual fallback but never
    // regain active controls after their pending field has been cleared.
    if (state.pendingField?.field !== expectedField) return undefined;
    if (reference.pickerType === "client") {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, business_name")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200);
      const options = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.business_name || row.full_name || "Client"),
      }));
      return { ...reference, data: { options } };
    }
    if (reference.pickerType === "project") {
      let query = supabase
        .from("projects")
        .select("id, name, client_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (z.string().uuid().safeParse(state.clientId).success) {
        query = query.eq("client_id", state.clientId);
      }
      const { data } = await query;
      const options = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.name || "Project"),
      }));
      return { ...reference, data: { options } };
    }
    return { ...reference, data: {} };
  }

  if (reference.type === "entity_result") {
    if (reference.entityType === "client") {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, business_name")
        .eq("id", reference.entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as Record<string, unknown> | null;
      if (!row) return undefined;
      return {
        ...reference,
        data: { id: String(row.id), name: String(row.business_name || row.full_name || "Client") },
      };
    }
    if (reference.entityType === "project") {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", reference.entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as Record<string, unknown> | null;
      if (!row) return undefined;
      return { ...reference, data: { id: String(row.id), name: String(row.name) } };
    }
    const { data } = await supabase
      .from("time_entries")
      .select("id, description, duration_seconds, billable")
      .eq("id", reference.entityId)
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as Record<string, unknown> | null;
    if (!row) return undefined;
    const duration = Number(row.duration_seconds ?? 0);
    return {
      ...reference,
      data: {
        id: String(row.id),
        description: String(row.description),
        hours: Math.floor(duration / 3600),
        minutes: Math.round((duration % 3600) / 60),
        billable: Boolean(row.billable),
      },
    };
  }

  if (reference.type === "entity_list") {
    if (reference.entityIds.length === 0) return { ...reference, data: { rows: [] } };
    const positions = new Map(reference.entityIds.map((id, index) => [id, index]));
    const sortRows = <T extends { id: string }>(rows: T[]) =>
      rows.sort((a, b) => (positions.get(a.id) ?? 999) - (positions.get(b.id) ?? 999));

    if (reference.entityType === "client") {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, business_name")
        .eq("user_id", userId)
        .in("id", reference.entityIds);
      const rows = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
        id: String(row.id),
        name: String(row.business_name || row.full_name || "Client"),
      }));
      return { ...reference, data: { rows: sortRows(rows) } };
    }

    if (reference.entityType === "invoice") {
      const { data } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_id, total_amount, currency, status, due_date")
        .eq("user_id", userId)
        .in("id", reference.entityIds);
      const records = (data as Array<Record<string, unknown>> | null) ?? [];
      const clientIds = records.map((row) => row.client_id).filter((id): id is string => typeof id === "string");
      const { data: clientsRaw } = clientIds.length
        ? await supabase.from("clients").select("id, full_name, business_name").eq("user_id", userId).in("id", clientIds)
        : { data: [] };
      const names = new Map(((clientsRaw as Array<Record<string, unknown>> | null) ?? []).map((row) => [
        String(row.id), String(row.business_name || row.full_name || "Client"),
      ]));
      const rows = records.map((row) => ({
        id: String(row.id),
        invoiceNumber: String(row.invoice_number),
        clientName: typeof row.client_id === "string" ? names.get(row.client_id) ?? "Unknown client" : "No client",
        totalAmount: Number(row.total_amount ?? 0),
        currency: String(row.currency || "INR"),
        status: String(row.status),
        dueDate: row.due_date ? String(row.due_date) : null,
      }));
      return { ...reference, data: { rows: sortRows(rows) } };
    }

    if (reference.entityType === "contract") {
      const { data } = await supabase
        .from("contracts")
        .select("id, title, kind, client_id, status")
        .eq("user_id", userId)
        .in("id", reference.entityIds);
      const records = (data as Array<Record<string, unknown>> | null) ?? [];
      const clientIds = records.map((row) => row.client_id).filter((id): id is string => typeof id === "string");
      const { data: clientsRaw } = clientIds.length
        ? await supabase.from("clients").select("id, full_name, business_name").eq("user_id", userId).in("id", clientIds)
        : { data: [] };
      const names = new Map(((clientsRaw as Array<Record<string, unknown>> | null) ?? []).map((row) => [
        String(row.id), String(row.business_name || row.full_name || "Client"),
      ]));
      const rows = records.map((row) => ({
        id: String(row.id),
        title: String(row.title),
        kind: row.kind === "proposal" ? "proposal" : "contract",
        clientName: typeof row.client_id === "string" ? names.get(row.client_id) ?? "Unknown client" : "No client",
        status: String(row.status),
      }));
      return { ...reference, data: { rows: sortRows(rows) } };
    }

    if (reference.entityType === "project") {
      const { data } = await supabase
        .from("projects")
        .select("id, name, client_id, status, due_date")
        .eq("user_id", userId)
        .in("id", reference.entityIds);
      const records = (data as Array<Record<string, unknown>> | null) ?? [];
      const clientIds = records.map((row) => row.client_id).filter((id): id is string => typeof id === "string");
      const { data: clientsRaw } = clientIds.length
        ? await supabase.from("clients").select("id, full_name, business_name").eq("user_id", userId).in("id", clientIds)
        : { data: [] };
      const names = new Map(((clientsRaw as Array<Record<string, unknown>> | null) ?? []).map((row) => [
        String(row.id), String(row.business_name || row.full_name || "Client"),
      ]));
      const rows = records.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        clientName: typeof row.client_id === "string" ? names.get(row.client_id) ?? "Unknown client" : "No client",
        status: String(row.status),
        dueDate: row.due_date ? String(row.due_date) : null,
      }));
      return { ...reference, data: { rows: sortRows(rows) } };
    }

    const { data } = await supabase
      .from("welcome_documents")
      .select("id, title, client_id, status, sent_at")
      .eq("user_id", userId)
      .in("id", reference.entityIds);
    const records = (data as Array<Record<string, unknown>> | null) ?? [];
    const clientIds = records.map((row) => row.client_id).filter((id): id is string => typeof id === "string");
    const [{ data: clientsRaw }, { data: viewsRaw }] = await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, full_name, business_name").eq("user_id", userId).in("id", clientIds)
        : Promise.resolve({ data: [] }),
      supabase.from("welcome_document_views").select("document_id, view_count").in("document_id", reference.entityIds),
    ]);
    const names = new Map(((clientsRaw as Array<Record<string, unknown>> | null) ?? []).map((row) => [
      String(row.id), String(row.business_name || row.full_name || "Client"),
    ]));
    const views = new Map<string, number>();
    for (const view of (viewsRaw as Array<Record<string, unknown>> | null) ?? []) {
      const id = String(view.document_id);
      views.set(id, (views.get(id) ?? 0) + Number(view.view_count ?? 0));
    }
    const rows = records.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      clientName: typeof row.client_id === "string" ? names.get(row.client_id) ?? "Unknown client" : "No client",
      status: String(row.status),
      views: views.get(String(row.id)) ?? 0,
      sentAt: row.sent_at ? String(row.sent_at) : null,
    }));
    return { ...reference, data: { rows: sortRows(rows) } };
  }

  // Entity previews are reconstructed from the latest canonical record.
  if (reference.entityType === "invoice") {
    const [{ data: invoiceRaw }, { data: lineRaw }] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, client_id, currency, subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, gst_amount, tax_mode, total_amount, due_date, status, terms, notes, is_export")
        .eq("id", reference.entityId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("invoice_items")
        .select("description, quantity, unit_price")
        .eq("invoice_id", reference.entityId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const invoice = invoiceRaw as Record<string, unknown> | null;
    const line = lineRaw as Record<string, unknown> | null;
    if (!invoice || !line) return undefined;
    const { data: clientRaw } = invoice.client_id
      ? await supabase
          .from("clients")
          .select("full_name, business_name, email, phone")
          .eq("id", String(invoice.client_id))
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null };
    const client = clientRaw as Record<string, unknown> | null;
    const quantity = Number(line.quantity ?? 1);
    const unitPrice = Number(line.unit_price ?? 0);
    return {
      ...reference,
      data: {
        id: String(invoice.id),
        invoiceNumber: String(invoice.invoice_number),
        clientName: String(client?.business_name || client?.full_name || "Selected client"),
        clientEmail: client?.email ? String(client.email) : null,
        clientPhone: client?.phone ? String(client.phone) : null,
        description: String(line.description ?? "Professional services"),
        quantity,
        unitPrice,
        originalSubtotal: quantity * unitPrice,
        discount: Number(invoice.discount_amount ?? 0),
        subtotal: Number(invoice.subtotal ?? 0),
        cgstAmount: Number(invoice.cgst_amount ?? 0),
        sgstAmount: Number(invoice.sgst_amount ?? 0),
        igstAmount: Number(invoice.igst_amount ?? 0),
        taxTotal: Number(invoice.gst_amount ?? 0),
        taxMode: String(invoice.tax_mode ?? "non_gst"),
        totalAmount: Number(invoice.total_amount ?? 0),
        currency: String(invoice.currency),
        dueDate: String(invoice.due_date),
        status: String(invoice.status),
        terms: invoice.terms ? String(invoice.terms) : null,
        notes: invoice.notes ? String(invoice.notes) : null,
        isExport: Boolean(invoice.is_export),
      },
    };
  }

  if (reference.entityType === "contract") {
    const { data: contractRaw } = await supabase
      .from("contracts")
      .select("id, title, kind, client_id, project_id, value_amount, currency, content, status")
      .eq("id", reference.entityId)
      .eq("user_id", userId)
      .maybeSingle();
    const contract = contractRaw as Record<string, unknown> | null;
    if (!contract) return undefined;
    const [{ data: clientRaw }, { data: projectRaw }] = await Promise.all([
      contract.client_id
        ? supabase
            .from("clients")
            .select("full_name, business_name, email, is_foreign")
            .eq("id", String(contract.client_id))
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      contract.project_id
        ? supabase
            .from("projects")
            .select("name")
            .eq("id", String(contract.project_id))
            .eq("user_id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const client = clientRaw as Record<string, unknown> | null;
    const project = projectRaw as Record<string, unknown> | null;
    return {
      ...reference,
      data: {
        id: String(contract.id),
        title: String(contract.title),
        kind: contract.kind === "proposal" ? "proposal" : "contract",
        clientName: String(client?.business_name || client?.full_name || "Selected client"),
        clientEmail: client?.email ? String(client.email) : null,
        projectName: project?.name ? String(project.name) : null,
        valueAmount: contract.value_amount == null ? null : Number(contract.value_amount),
        currency: String(contract.currency),
        sections: parseDocumentSections(contract.content),
        status: String(contract.status),
        isInternational: Boolean(client?.is_foreign),
      },
    };
  }

  const { data: documentRaw } = await supabase
    .from("welcome_documents")
    .select("id, title, intro, content, client_id, project_id, status")
    .eq("id", reference.entityId)
    .eq("user_id", userId)
    .maybeSingle();
  const document = documentRaw as Record<string, unknown> | null;
  if (!document) return undefined;
  const [{ data: clientRaw }, { data: projectRaw }] = await Promise.all([
    document.client_id
      ? supabase
          .from("clients")
          .select("full_name, business_name, email, phone")
          .eq("id", String(document.client_id))
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    document.project_id
      ? supabase
          .from("projects")
          .select("name")
          .eq("id", String(document.project_id))
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const client = clientRaw as Record<string, unknown> | null;
  const project = projectRaw as Record<string, unknown> | null;
  return {
    ...reference,
    data: {
      id: String(document.id),
      title: String(document.title),
      intro: document.intro ? String(document.intro) : null,
      sections: parseDocumentSections(document.content),
      clientName: client?.business_name || client?.full_name
        ? String(client?.business_name || client?.full_name)
        : null,
      clientEmail: client?.email ? String(client.email) : null,
      clientPhone: client?.phone ? String(client.phone) : null,
      projectName: project?.name ? String(project.name) : null,
      status: String(document.status),
    },
  };
}

async function readSnapshot(
  conversation: IvoConversationRow,
): Promise<IvoConversationSnapshot> {
  const { supabase, userId } = await requireUser();
  const state = parseState(conversation.workflow_state);
  const { data, error } = await supabase
    .from("ivo_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .eq("user_id", userId)
    .in("role", ["user", "assistant"])
    .in("kind", ["text", "question", "picker", "preview", "confirmation", "error", "result"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    log.warn("ivo.conversation.messages_read_failed", {
      userId,
      entity: { type: "ivo_conversation", id: conversation.id },
      code: error.code,
    });
  }

  const rows = ((data as unknown as IvoMessageRow[] | null) ?? [])
    .reverse()
    .filter((row) => row.content && (row.role === "user" || row.role === "assistant"));
  const messages = await Promise.all(rows.map(async (row) => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload
      : {};
    const reference = messageBlockSchema.safeParse(payload.block);
    const suggestions = z.array(z.string().max(300)).max(10).safeParse(payload.suggestions);
    const tip = z.string().max(1000).safeParse(payload.tip);
    return {
      id: row.id,
      role: row.role as "user" | "assistant",
      kind: row.kind as "text" | "question" | "picker" | "preview" | "confirmation" | "error" | "result",
      content: row.content!,
      ...(suggestions.success ? { suggestions: suggestions.data } : {}),
      ...(tip.success ? { tip: tip.data } : {}),
      ...(reference.success
        ? { block: await resolveMessageBlock(reference.data, userId, state) }
        : {}),
      createdAt: row.created_at,
    };
  }));

  return {
    id: conversation.id,
    title: conversation.title,
    state,
    messages,
  };
}

async function findActiveConversation(userId: string) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("ivo_conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as unknown as IvoConversationRow | null;
}

export async function resumeIvoConversationAction(): Promise<
  { ok: true; data: IvoConversationSnapshot } | { ok: false; error: string }
> {
  try {
    const { supabase, userId } = await requireUser();
    let conversation = await findActiveConversation(userId);
    if (!conversation) {
      const { data, error } = await supabase
        .from("ivo_conversations")
        .insert({ user_id: userId } as never)
        .select("*")
        .single();
      if (error) {
        // A second tab may have won the partial-unique-index race.
        conversation = await findActiveConversation(userId);
        if (!conversation) throw error;
      } else {
        conversation = data as unknown as IvoConversationRow;
      }
    }
    return { ok: true, data: await readSnapshot(conversation) };
  } catch (error) {
    log.warn("ivo.conversation.resume_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Ivo could not restore the conversation." };
  }
}

export async function startNewIvoConversationAction(): Promise<
  { ok: true; data: IvoConversationSnapshot } | { ok: false; error: string }
> {
  try {
    const { supabase, userId } = await requireUser();
    await supabase
      .from("ivo_conversations")
      .update({ status: "archived" } as never)
      .eq("user_id", userId)
      .eq("status", "active");
    const { data, error } = await supabase
      .from("ivo_conversations")
      .insert({ user_id: userId } as never)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Conversation was not created");
    return { ok: true, data: await readSnapshot(data as unknown as IvoConversationRow) };
  } catch (error) {
    log.warn("ivo.conversation.create_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Ivo could not start a new conversation." };
  }
}

export async function appendIvoMessageAction(
  input: z.input<typeof messageSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = messageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid conversation message." };
  try {
    const { supabase, userId } = await requireUser();
    const { data: owned } = await supabase
      .from("ivo_conversations")
      .select("id, title")
      .eq("id", parsed.data.conversationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!owned) return { ok: false, error: "Conversation not found." };

    const { error } = await supabase.from("ivo_messages").upsert(
      {
        conversation_id: parsed.data.conversationId,
        user_id: userId,
        role: parsed.data.role,
        kind: parsed.data.kind,
        content: parsed.data.content,
        payload: {
          ...(parsed.data.suggestions ? { suggestions: parsed.data.suggestions } : {}),
          ...(parsed.data.tip ? { tip: parsed.data.tip } : {}),
          ...(parsed.data.block ? { block: parsed.data.block } : {}),
        },
        client_message_id: parsed.data.clientMessageId,
      } as never,
      { onConflict: "conversation_id,client_message_id", ignoreDuplicates: true },
    );
    if (error) throw error;

    const title =
      parsed.data.role === "user" && !(owned as { title?: string | null }).title
        ? parsed.data.content.replace(/\s+/g, " ").slice(0, 80)
        : undefined;
    await supabase
      .from("ivo_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        ...(title ? { title } : {}),
      } as never)
      .eq("id", parsed.data.conversationId)
      .eq("user_id", userId);
    return { ok: true };
  } catch (error) {
    log.warn("ivo.conversation.message_append_failed", {
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_conversation", id: parsed.data.conversationId },
    });
    return { ok: false, error: "The conversation message was not saved." };
  }
}

export async function saveIvoConversationStateAction(
  input: z.input<typeof saveStateSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = saveStateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid conversation state." };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("ivo_conversations")
      .update({
        current_mode: parsed.data.state.mode as IvoMode,
        workflow_state: parsed.data.state as unknown as Json,
      } as never)
      .eq("id", parsed.data.conversationId)
      .eq("user_id", userId)
      .eq("status", "active");
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    log.warn("ivo.conversation.state_save_failed", {
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_conversation", id: parsed.data.conversationId },
    });
    return { ok: false, error: "The conversation state was not saved." };
  }
}

export async function planIvoWorkflowProgressAction(
  input: z.input<typeof workflowProgressInputSchema>,
) {
  const parsed = workflowProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "The workflow state is invalid." };
  }
  try {
    const { supabase, userId } = await requireUser();
    const { data: conversation } = await supabase
      .from("ivo_conversations")
      .select("id")
      .eq("id", parsed.data.conversationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!conversation) {
      return { ok: false as const, error: "This Ivo workflow is no longer available." };
    }

    const clients = await listClients({ limit: 200 });
    const selectedClient = clients.find((client) => client.id === parsed.data.clientId);
    const nextAction = planIvoWorkflowNextAction({
      workflow: parsed.data.workflow,
      fields: parsed.data.fields,
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      currency: selectedClient?.isForeign ? selectedClient.currency : "INR",
      requestId: randomUUID(),
    });
    return { ok: true as const, nextAction };
  } catch (error) {
    log.warn("ivo.conversation.progress_plan_failed", {
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_conversation", id: parsed.data.conversationId },
    });
    return { ok: false as const, error: "I couldn't continue that workflow safely." };
  }
}

/**
 * Server-owned front door for a model-routed user message. It persists the
 * input idempotently, applies quota/rate policy, records an Ivo run, and only
 * then invokes NLU and returns the exact next field, support route, or typed
 * tool invocation that the client is allowed to render/dispatch.
 */
export async function processIvoMessageAction(
  input: z.input<typeof processMessageSchema>,
  /**
   * Server-side hooks (streaming route handler only). Never populated when the
   * client invokes this as a server action — callbacks are not serializable.
   */
  hooks?: {
    onStatus?: (status: string) => void;
    onDelta?: (text: string) => void;
  },
) {
  const parsed = processMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, reason: "validation" as const, error: "Tell me what you'd like to do." };
  }

  const startedAt = Date.now();
  let runId: string | null = null;
  let usageConsumed = false;
  try {
    const { supabase, userId } = await requireUser();
    const { data: conversation } = await supabase
      .from("ivo_conversations")
      .select("id")
      .eq("id", parsed.data.conversationId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!conversation) {
      return { ok: false as const, reason: "conversation" as const, error: "Conversation not found." };
    }

    const persisted = await appendIvoMessageAction({
      conversationId: parsed.data.conversationId,
      clientMessageId: parsed.data.clientMessageId,
      role: "user",
      kind: "text",
      content: parsed.data.message,
    });
    if (!persisted.ok) throw new Error(persisted.error);

    const { data: run, error: runError } = await supabase
      .from("ivo_runs")
      .insert({
        conversation_id: parsed.data.conversationId,
        user_id: userId,
        operation: "intent_extraction",
        request_key: parsed.data.clientMessageId,
        status: "running",
      } as never)
      .select("id")
      .single();
    if (runError?.code === "23505") {
      return {
        ok: false as const,
        reason: "duplicate" as const,
        error: "That message is already being processed.",
        usageConsumed: false,
      };
    }
    if (runError || !run) throw runError ?? new Error("Run was not created");
    runId = (run as { id: string }).id;

    const usage = await getUsageSnapshot("ai_messages");
    if (usage && usage.limit !== Infinity && usage.used >= usage.limit) {
      const subscription = await getCurrentSubscription();
      const plan = effectivePlan(subscription);
      await supabase
        .from("ivo_runs")
        .update({
          status: "cancelled",
          outcome: "quota_exhausted",
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        } as never)
        .eq("id", runId)
        .eq("user_id", userId);
      return {
        ok: false as const,
        reason: "quota" as const,
        limit: usage.limit,
        plan,
      };
    }
    if (usage) {
      await incrementUsage("ai_messages");
      usageConsumed = true;
    }

    const rate = await aiGenerateLimit(`aigen:${userId}`);
    if (!rate.ok) {
      await supabase
        .from("ivo_runs")
        .update({
          status: "cancelled",
          outcome: "rate_limited",
          duration_ms: Date.now() - startedAt,
          finished_at: new Date().toISOString(),
        } as never)
        .eq("id", runId)
        .eq("user_id", userId);
      return {
        ok: false as const,
        reason: "rate_limit" as const,
        error: rate.message,
        usageConsumed,
      };
    }

    let activeDraft: z.infer<typeof processMessageSchema>["activeDraft"];
    const requestedDraft = parsed.data.activeDraft;
    if (requestedDraft) {
      const table = requestedDraft.entityType === "invoice"
        ? "invoices"
        : requestedDraft.entityType === "contract"
          ? "contracts"
          : "welcome_documents";
      const { data: draft } = await supabase
        .from(table)
        .select("id, status")
        .eq("id", requestedDraft.entityId)
        .eq("user_id", userId)
        .eq("status", "draft")
        .maybeSingle();
      if (draft) activeDraft = requestedDraft;
    }

    const [clients, projects, profile] = await Promise.all([
      listClients({ limit: 200 }),
      listProjects({ limit: 200 }),
      getProfile().catch(() => null),
    ]);

    // ---- Primary path: the model-driven agent loop ----------------------
    // The agent reads the workspace through tools, chooses the action, and
    // writes the reply itself. All create/send operations still flow through
    // the same approval-gated decisions the client already enforces.
    const agent = await runIvoAgent({
      message: parsed.data.message,
      history: parsed.data.history?.slice(-10) ?? [],
      userId,
      firstName:
        (profile?.displayName || profile?.fullName || "").trim().split(/\s+/)[0] || null,
      currentMode: parsed.data.currentWorkflow ?? "general",
      collected: parsed.data.collected ?? {},
      pendingField: parsed.data.pendingField,
      activeDraft,
      page: parsed.data.page,
      clients,
      projects,
      requestId: runId,
      onStatus: hooks?.onStatus,
      onDelta: hooks?.onDelta,
    }).catch((error) => {
      log.warn("ivo.agent.failed", {
        error: error instanceof Error ? error.message : "unknown",
        entity: { type: "ivo_conversation", id: parsed.data.conversationId },
      });
      return null;
    });

    if (agent) {
      const decisionParsed = ivoRuntimeDecisionSchema.safeParse(agent.decision);
      if (decisionParsed.success) {
        const decision = decisionParsed.data;
        // Synthetic interpretation keeps older client logic (chit-chat guard,
        // confidence checks) working without a second NLU round-trip.
        const interpretation: AiInterpretation = {
          intent:
            decision.kind === "workflow"
              ? decision.targetMode === "general"
                ? "general"
                : decision.targetMode
              : decision.kind === "reply"
                ? "general"
                : "query",
          confident: decision.kind !== "reply",
          fields: decision.kind === "workflow" ? decision.fields : {},
          ...(decision.kind === "workflow" && decision.clientId
            ? { clientId: decision.clientId }
            : {}),
          ...(decision.kind === "workflow" && decision.projectId
            ? { projectId: decision.projectId }
            : {}),
          provider: "groq",
        };
        await supabase
          .from("ivo_runs")
          .update({
            provider: "groq",
            model: agent.model,
            status: "succeeded",
            outcome: "agent_succeeded",
            prompt_tokens: agent.promptTokens || null,
            completion_tokens: agent.completionTokens || null,
            duration_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
            metadata: {
              route: decision.kind,
              rounds: agent.rounds,
              nextAction: decision.kind === "workflow" ? decision.nextAction.kind : null,
            },
          } as never)
          .eq("id", runId)
          .eq("user_id", userId);
        return {
          ok: true as const,
          data: {
            interpretation,
            decision,
            say: agent.say || undefined,
            suggestions: agent.suggestions.length > 0 ? agent.suggestions : undefined,
            runId,
            usageConsumed,
          },
        };
      }
      log.warn("ivo.agent.invalid_decision", {
        entity: { type: "ivo_conversation", id: parsed.data.conversationId },
      });
    }

    // ---- Fallback: deterministic NLU + planner (Groq degraded/offline) ---
    const result = await interpretMessageDetailed({
      message: parsed.data.message,
      currentWorkflow: parsed.data.currentWorkflow,
      collected: parsed.data.collected,
      history: parsed.data.history?.slice(-6),
      clients,
      projects,
    });
    const resolvedClientForPlan =
      result.interpretation.clientId || parsed.data.clientId || "";
    const selectedClientForPlan = clients.find(
      (client) => client.id === resolvedClientForPlan,
    );
    const meta = result.providerMeta;
    const decision = ivoRuntimeDecisionSchema.parse(
      planIvoRuntime({
        message: parsed.data.message,
        interpretation: result.interpretation,
        currentMode: parsed.data.currentWorkflow ?? "general",
        collected: parsed.data.collected ?? {},
        pendingField: parsed.data.pendingField,
        clientId: parsed.data.clientId ?? "",
        projectId: parsed.data.projectId ?? "",
        clientCurrency: selectedClientForPlan?.isForeign
          ? selectedClientForPlan.currency
          : "INR",
        requestId: runId,
        pendingProposal: parsed.data.pendingProposal,
        activeDraft,
      }),
    );
    const outcome =
      result.interpretation.provider === "groq"
        ? "model_succeeded"
        : `local_fallback:${meta?.outcome ?? "unavailable"}`;

    await supabase
      .from("ivo_runs")
      .update({
        provider: result.interpretation.provider,
        model: meta?.model ?? null,
        status: "succeeded",
        outcome,
        prompt_tokens: meta?.promptTokens ?? null,
        completion_tokens: meta?.completionTokens ?? null,
        duration_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
        metadata: {
          intent: result.interpretation.intent,
          confident: result.interpretation.confident,
          providerOutcome: meta?.outcome ?? "local_only",
          attempts: meta?.attempts ?? 0,
          route: decision.kind,
          nextAction: decision.kind === "workflow" ? decision.nextAction.kind : null,
          tool:
            decision.kind === "workflow" && decision.nextAction.kind === "invoke_tool"
              ? decision.nextAction.tool
              : null,
        },
      } as never)
      .eq("id", runId)
      .eq("user_id", userId);

    return {
      ok: true as const,
      data: {
        interpretation: result.interpretation,
        decision,
        say: undefined as string | undefined,
        suggestions: undefined as string[] | undefined,
        runId,
        usageConsumed,
      },
    };
  } catch (error) {
    try {
      if (runId) {
        const { supabase, userId } = await requireUser();
        await supabase
          .from("ivo_runs")
          .update({
            status: "failed",
            outcome: "runtime_error",
            error_code: "PROCESS_MESSAGE_FAILED",
            duration_ms: Date.now() - startedAt,
            finished_at: new Date().toISOString(),
          } as never)
          .eq("id", runId)
          .eq("user_id", userId);
      }
    } catch {
      // Preserve the original failure; the structured log remains available.
    }
    log.warn("ivo.message.process_failed", {
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_conversation", id: parsed.data.conversationId },
    });
    return {
      ok: false as const,
      reason: "runtime" as const,
      error: "Ivo couldn't process that message.",
      usageConsumed,
    };
  }
}
