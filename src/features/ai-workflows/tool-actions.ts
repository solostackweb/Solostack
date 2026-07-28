"use server";

import { createHash } from "node:crypto";
import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { createTicketAction } from "@/features/support/ticket-actions";
import { saveAsTemplateAction } from "@/features/welcome-documents/actions";
import {
  approveInvoiceFromAiAction,
  approveWelcomeDocFromAiAction,
  createClientFromAiAction,
  createContractFromAiAction,
  createInvoiceFromAiAction,
  createMeetingFromAiAction,
  createProjectFromAiAction,
  createProposalFromAiAction,
  createTimeEntryFromAiAction,
  createWelcomeDocFromAiAction,
  emailInvoiceFromAiAction,
  invoiceUnbilledTimeFromAiAction,
  invoiceWhatsappFromAiAction,
  markInvoicePaidFromAiAction,
  refineContractFromAiAction,
  refineInvoiceFromAiAction,
  refineWelcomeDocFromAiAction,
  remindOverdueInvoicesFromAiAction,
  sendContractFromAiAction,
  sendWelcomeDocFromAiAction,
  contractWhatsappFromAiAction,
  welcomeDocWhatsappFromAiAction,
} from "./domain-operations";
import type { AiMissingField } from "./types";
import type { IvoToolResponseDescriptor } from "./conversation-types";
import { assertIvoToolPath, ivoToolApprovalState, ivoToolPolicy } from "./tool-registry";

type IvoCreateToolKey =
  | "client.create"
  | "project.create"
  | "time_entry.create"
  | "invoice.draft"
  | "invoice.unbilled_draft"
  | "contract.draft"
  | "welcome_document.draft";

const toolInputSchema = z.object({
  conversationId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  idempotencyKey: z.string().uuid(),
  fields: z.record(z.string().max(6000)).default({}),
  clientId: z.string().max(100).optional(),
  projectId: z.string().max(100).optional(),
  prompt: z.string().max(6000).optional(),
  confirm: z.boolean().default(false),
});
const rejectToolSchema = z.object({
  conversationId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});
const statusToolInputSchema = z.object({
  conversationId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  entityId: z.string().uuid(),
});
const deliveryToolInputSchema = statusToolInputSchema.extend({
  requestId: z.string().uuid(),
});
const refinementToolInputSchema = deliveryToolInputSchema.extend({
  instruction: z.string().trim().min(2).max(2000),
});
const explicitCreateToolInputSchema = z.object({
  conversationId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  requestId: z.string().uuid(),
});

type ToolInput = z.input<typeof toolInputSchema>;
type ToolRuntimeError = { ok: false; error: string };
type ClientToolResult = Awaited<ReturnType<typeof createClientFromAiAction>>;
type ProjectToolResult = Awaited<ReturnType<typeof createProjectFromAiAction>>;
type TimeEntryToolResult = Awaited<ReturnType<typeof createTimeEntryFromAiAction>>;
type ToolResult = ClientToolResult | ProjectToolResult | TimeEntryToolResult;
type DraftToolError = {
  ok: false;
  error: string;
  missing?: AiMissingField;
  clientChoices?: Array<{ id: string; name: string }>;
};

const sectionSchema = z.object({ heading: z.string(), body: z.string() });
const invoicePreviewSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  clientName: z.string(),
  clientEmail: z.string().nullable(),
  clientPhone: z.string().nullable(),
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  originalSubtotal: z.number(),
  discount: z.number(),
  subtotal: z.number(),
  cgstAmount: z.number().optional(),
  sgstAmount: z.number().optional(),
  igstAmount: z.number().optional(),
  taxTotal: z.number(),
  taxMode: z.enum(["non_gst", "cgst_sgst", "igst"]).optional(),
  totalAmount: z.number(),
  currency: z.string(),
  dueDate: z.string(),
  status: z.string(),
  terms: z.string().nullable(),
  notes: z.string().nullable(),
  isExport: z.boolean().optional(),
});
const contractPreviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  kind: z.enum(["contract", "proposal"]),
  clientName: z.string(),
  clientEmail: z.string().nullable(),
  projectName: z.string().nullable(),
  valueAmount: z.number().nullable(),
  currency: z.string(),
  sections: z.array(sectionSchema),
  isInternational: z.boolean().optional(),
});
const welcomePreviewSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  intro: z.string().nullable(),
  sections: z.array(sectionSchema),
  clientName: z.string().nullable(),
  clientEmail: z.string().nullable(),
  clientPhone: z.string().nullable(),
  projectName: z.string().nullable(),
});
const unbilledInvoicePreviewSchema = z.object({
  id: z.string().uuid(),
  invoiceNumber: z.string(),
  clientName: z.string(),
  totalAmount: z.number(),
  currency: z.string(),
  hours: z.number(),
  lineCount: z.number().int().nonnegative(),
});

type ContractDraftToolResult =
  | { ok: true; data: z.infer<typeof contractPreviewSchema>; message: string }
  | DraftToolError;
type WelcomeDraftToolResult =
  | { ok: true; data: z.infer<typeof welcomePreviewSchema>; message: string }
  | DraftToolError;
type InvoiceRefinementToolResult =
  | { ok: true; data: z.infer<typeof invoicePreviewSchema>; message: string }
  | DraftToolError;
type ContractRefinementToolResult = ContractDraftToolResult;
type WelcomeRefinementToolResult = WelcomeDraftToolResult;
type UnbilledInvoiceToolResult =
  | { ok: true; data: z.infer<typeof unbilledInvoicePreviewSchema>; message: string }
  | DraftToolError;
type InvoiceRefinementSuccess = Extract<InvoiceRefinementToolResult, { ok: true }>;
type ContractRefinementSuccess = Extract<ContractRefinementToolResult, { ok: true }>;
type WelcomeRefinementSuccess = Extract<WelcomeRefinementToolResult, { ok: true }>;

function confirmationResponse(requestId: string, title: string): IvoToolResponseDescriptor {
  return {
    kind: "confirmation",
    content: title,
    block: { type: "confirmation", requestId },
  };
}

function entityResponse(
  kind: "preview" | "result",
  content: string,
  block: IvoToolResponseDescriptor["block"],
): IvoToolResponseDescriptor {
  return { kind, content, block };
}

/** A completed outcome with no resumable card — delivery, publish, share prep. */
function outcomeResponse(content: string): IvoToolResponseDescriptor {
  return { kind: "result", content };
}

/**
 * Attaches the canonical response descriptor to a successful tool outcome.
 *
 * Only successes carry a descriptor: a failure is surfaced as an error string
 * and must never be persisted as an actionable conversation block. `describe`
 * runs after the mutation so it may reread canonical records for its copy.
 */
async function withResponse<T extends { ok: boolean }>(
  result: T,
  describe: () => IvoToolResponseDescriptor | Promise<IvoToolResponseDescriptor>,
): Promise<T & { response?: IvoToolResponseDescriptor }> {
  if (!result.ok) return result;
  return { ...result, response: await describe() };
}

const cachedClientSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  businessName: z.string(),
  email: z.string(),
  phone: z.string(),
});
const cachedProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});
const cachedTimeEntrySchema = z.object({
  id: z.string(),
  description: z.string(),
  hours: z.number(),
  minutes: z.number(),
  billable: z.boolean(),
  hourlyRate: z.number(),
});

function inputHash(toolKey: IvoCreateToolKey, input: z.output<typeof toolInputSchema>) {
  const sortedFields = Object.fromEntries(
    Object.entries(input.fields).sort(([left], [right]) => left.localeCompare(right)),
  );
  return createHash("sha256")
    .update(JSON.stringify({
      toolKey,
      fields: sortedFields,
      clientId: input.clientId ?? "",
      projectId: input.projectId ?? "",
      prompt: input.prompt ?? "",
    }))
    .digest("hex");
}

async function requireOwnedContext(conversationId: string, runId?: string) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: conversation } = await supabase
    .from("ivo_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!conversation) return null;

  if (runId) {
    const { data: run } = await supabase
      .from("ivo_runs")
      .select("id")
      .eq("id", runId)
      .eq("user_id", user.id)
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (!run) return null;
  }
  return { supabase, userId: user.id };
}

async function runCreateTool<T extends ToolResult>(
  toolKey: IvoCreateToolKey,
  entityType: "client" | "project" | "time_entry",
  rawInput: ToolInput,
  invoke: (input: z.output<typeof toolInputSchema>) => Promise<T>,
  readCached: (entityId: string, userId: string) => Promise<T | null>,
): Promise<T | ToolRuntimeError> {
  assertIvoToolPath(toolKey, "approved");
  const parsed = toolInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "The Ivo action request is invalid." };

  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false, error: "This Ivo action is no longer available." };
  const { supabase, userId } = context;
  const hash = inputHash(toolKey, parsed.data);

  const { data: existingRaw } = await supabase
    .from("ivo_action_attempts")
    .select("id, approval_state, status, input_summary, output_summary, entity_id")
    .eq("user_id", userId)
    .eq("idempotency_key", parsed.data.idempotencyKey)
    .maybeSingle();
  const existing = existingRaw as {
    id: string;
    approval_state: string;
    status: string;
    input_summary: Json;
    output_summary: Json;
    entity_id: string | null;
  } | null;
  const existingHash =
    existing?.input_summary && typeof existing.input_summary === "object" && !Array.isArray(existing.input_summary)
      ? String(existing.input_summary.inputHash ?? "")
      : "";

  if (existing && existingHash !== hash) {
    return { ok: false, error: "The action changed after it was previewed. Please review it again." };
  }

  if (parsed.data.confirm) {
    if (existing?.status === "succeeded") {
      const cached = existing.entity_id
        ? await readCached(existing.entity_id, userId)
        : null;
      return cached ?? { ok: false, error: "This action was already completed." };
    }
    if (!existing || existing.approval_state !== "required") {
      return { ok: false, error: "Review this action in Ivo before confirming it." };
    }
    if (existing.status !== "proposed") {
      return { ok: false, error: "This action is already being processed or cannot be retried." };
    }

    const { data: claimed } = await supabase
      .from("ivo_action_attempts")
      .update({ approval_state: "approved", status: "executing" } as never)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .eq("status", "proposed")
      .select("id")
      .maybeSingle();
    if (!claimed) return { ok: false, error: "This action is already being processed." };

    try {
      const result = await invoke(parsed.data);
      if (result.ok) {
        await supabase
          .from("ivo_action_attempts")
          .update({
            status: "succeeded",
            output_summary: { completed: true },
            entity_type: entityType,
            entity_id: result.data.id,
          } as never)
          .eq("id", existing.id)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("ivo_action_attempts")
          .update({ status: "failed", error_code: "TOOL_REJECTED" } as never)
          .eq("id", existing.id)
          .eq("user_id", userId);
      }
      return result;
    } catch (error) {
      await supabase
        .from("ivo_action_attempts")
        .update({ status: "failed", error_code: "TOOL_RUNTIME_ERROR" } as never)
        .eq("id", existing.id)
        .eq("user_id", userId);
      log.warn("ivo.tool.execution_failed", {
        toolKey,
        error: error instanceof Error ? error.message : "unknown",
        entity: { type: "ivo_action_attempt", id: existing.id },
      });
      return { ok: false, error: "Ivo couldn't complete that action." };
    }
  }

  const proposal = await invoke(parsed.data);
  if (!("needsConfirm" in proposal) || !proposal.needsConfirm) return proposal;

  const { error: insertError } = await supabase.from("ivo_action_attempts").insert({
    conversation_id: parsed.data.conversationId,
    run_id: parsed.data.runId ?? null,
    user_id: userId,
    tool_key: toolKey,
    idempotency_key: parsed.data.idempotencyKey,
    approval_state: "required",
    status: "proposed",
    input_summary: {
      inputHash: hash,
      fieldNames: Object.keys(parsed.data.fields).sort(),
      hasClient: Boolean(parsed.data.clientId),
      hasProject: Boolean(parsed.data.projectId),
    },
  } as never);
  if (insertError && insertError.code !== "23505") {
    log.warn("ivo.tool.proposal_save_failed", { toolKey, code: insertError.code });
    return { ok: false, error: "Ivo couldn't save this approval request." };
  }
  if (insertError?.code === "23505") {
    const { data: collisionRaw } = await supabase
      .from("ivo_action_attempts")
      .select("input_summary")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    const collision = collisionRaw as { input_summary?: Json } | null;
    const collisionHash =
      collision?.input_summary &&
      typeof collision.input_summary === "object" &&
      !Array.isArray(collision.input_summary)
        ? String(collision.input_summary.inputHash ?? "")
        : "";
    if (collisionHash !== hash) {
      return { ok: false, error: "This action request conflicts with an earlier preview." };
    }
  }
  return proposal;
}

async function runImmediateDraftTool<T extends { ok: true; data: unknown; message: string }>(
  toolKey: IvoCreateToolKey,
  entityType: "invoice" | "contract" | "welcome_document",
  rawInput: ToolInput,
  invoke: (input: z.output<typeof toolInputSchema>) => Promise<unknown>,
  normalize: (value: unknown) => T | DraftToolError,
  readCached: (entityId: string, userId: string) => Promise<T | null>,
): Promise<T | DraftToolError> {
  assertIvoToolPath(toolKey, "draft");
  const parsed = toolInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "I couldn't set that draft up from the details I have. Try rephrasing in one line — for example: “Invoice Acme ₹25,000 for the landing page, due in 15 days.”",
    };
  }
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false, error: "This Ivo draft action is no longer available." };
  const { supabase, userId } = context;
  const hash = inputHash(toolKey, parsed.data);

  const readAttempt = async () => {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .select("id, status, input_summary, entity_id")
      .eq("user_id", userId)
      .eq("idempotency_key", parsed.data.idempotencyKey)
      .maybeSingle();
    return data as {
      id: string;
      status: string;
      input_summary: Json;
      entity_id: string | null;
    } | null;
  };
  const attemptHash = (attempt: Awaited<ReturnType<typeof readAttempt>>) =>
    attempt?.input_summary &&
    typeof attempt.input_summary === "object" &&
    !Array.isArray(attempt.input_summary)
      ? String(attempt.input_summary.inputHash ?? "")
      : "";

  let attempt = await readAttempt();
  if (attempt) {
    if (attemptHash(attempt) !== hash) {
      return { ok: false, error: "The draft request conflicts with an earlier action." };
    }
    if (attempt.status === "succeeded" && attempt.entity_id) {
      const cached = await readCached(attempt.entity_id, userId);
      return cached ?? { ok: false, error: "This draft was already created." };
    }
    return { ok: false, error: "This draft action is already being processed or was completed." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ivo_action_attempts")
    .insert({
      conversation_id: parsed.data.conversationId,
      run_id: parsed.data.runId ?? null,
      user_id: userId,
      tool_key: toolKey,
      idempotency_key: parsed.data.idempotencyKey,
      approval_state: ivoToolApprovalState(toolKey),
      status: "executing",
      input_summary: {
        inputHash: hash,
        policy: ivoToolPolicy(toolKey),
        fieldNames: Object.keys(parsed.data.fields).sort(),
        hasClient: Boolean(parsed.data.clientId),
        hasProject: Boolean(parsed.data.projectId),
      },
    } as never)
    .select("id")
    .maybeSingle();

  if (insertError?.code === "23505") {
    attempt = await readAttempt();
    if (!attempt || attemptHash(attempt) !== hash) {
      return { ok: false, error: "The draft request conflicts with an earlier action." };
    }
    if (attempt.status === "succeeded" && attempt.entity_id) {
      const cached = await readCached(attempt.entity_id, userId);
      return cached ?? { ok: false, error: "This draft was already created." };
    }
    return { ok: false, error: "This draft action is already being processed." };
  }
  if (insertError || !inserted) {
    log.warn("ivo.tool.draft_claim_failed", { toolKey, code: insertError?.code ?? "unknown" });
    return { ok: false, error: "Ivo couldn't safely start this draft." };
  }
  const attemptId = (inserted as { id: string }).id;

  try {
    const result = normalize(await invoke(parsed.data));
    if (result.ok) {
      const entityId = (result.data as { id?: unknown; preview?: { id?: unknown } }).preview?.id
        ?? (result.data as { id?: unknown }).id;
      if (typeof entityId !== "string") throw new Error("Draft entity id was not returned");
      await supabase
        .from("ivo_action_attempts")
        .update({
          status: "succeeded",
          output_summary: { completed: true },
          entity_type: entityType,
          entity_id: entityId,
        } as never)
        .eq("id", attemptId)
        .eq("user_id", userId);
    } else {
      if (result.missing) {
        await supabase
          .from("ivo_action_attempts")
          .delete()
          .eq("id", attemptId)
          .eq("user_id", userId);
      } else {
        await supabase
          .from("ivo_action_attempts")
          .update({ status: "failed", error_code: "TOOL_REJECTED" } as never)
          .eq("id", attemptId)
          .eq("user_id", userId);
      }
    }
    return result;
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "TOOL_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.draft_execution_failed", {
      toolKey,
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false, error: "Ivo couldn't create that draft." };
  }
}

async function runRefinementTool<T extends { ok: true; data: unknown; message: string }>(
  toolKey: "invoice.refine" | "contract.refine" | "welcome_document.refine",
  entityType: "invoice" | "contract" | "welcome_document",
  rawInput: z.input<typeof refinementToolInputSchema>,
  invoke: (entityId: string, instruction: string) => Promise<unknown>,
  normalize: (value: unknown) => T | DraftToolError,
  readCompleted: (entityId: string, userId: string) => Promise<T | null>,
): Promise<T | DraftToolError> {
  assertIvoToolPath(toolKey, "draft");
  const parsed = refinementToolInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "The Ivo refinement request is invalid." };
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false, error: "This Ivo refinement is no longer available." };
  const { supabase, userId } = context;
  const attemptKey = `${toolKey}:${parsed.data.requestId}`;
  const hash = createHash("sha256")
    .update(JSON.stringify({
      toolKey,
      entityId: parsed.data.entityId,
      instruction: parsed.data.instruction,
    }))
    .digest("hex");

  const readAttempt = async () => {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .select("id, status, input_summary, entity_id")
      .eq("user_id", userId)
      .eq("idempotency_key", attemptKey)
      .maybeSingle();
    return data as {
      id: string;
      status: string;
      input_summary: Json;
      entity_id: string | null;
    } | null;
  };
  const readHash = (attempt: Awaited<ReturnType<typeof readAttempt>>) =>
    attempt?.input_summary &&
    typeof attempt.input_summary === "object" &&
    !Array.isArray(attempt.input_summary)
      ? String(attempt.input_summary.inputHash ?? "")
      : "";

  let attempt = await readAttempt();
  if (attempt && readHash(attempt) !== hash) {
    return { ok: false, error: "This refinement conflicts with an earlier request." };
  }
  if (attempt?.status === "succeeded") {
    return (await readCompleted(parsed.data.entityId, userId))
      ?? { ok: false, error: "This refinement was already completed." };
  }
  if (attempt?.status === "executing") {
    return { ok: false, error: "This refinement is already being processed." };
  }

  let attemptId: string | null = null;
  if (attempt?.status === "failed") {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .update({ status: "executing", error_code: null } as never)
      .eq("id", attempt.id)
      .eq("user_id", userId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    attemptId = (data as { id?: string } | null)?.id ?? null;
  } else if (!attempt) {
    const { data, error } = await supabase
      .from("ivo_action_attempts")
      .insert({
        conversation_id: parsed.data.conversationId,
        run_id: parsed.data.runId ?? null,
        user_id: userId,
        tool_key: toolKey,
        idempotency_key: attemptKey,
        approval_state: ivoToolApprovalState(toolKey),
        status: "executing",
        input_summary: {
          inputHash: hash,
          policy: ivoToolPolicy(toolKey),
          instructionLength: parsed.data.instruction.length,
        },
        entity_type: entityType,
        entity_id: parsed.data.entityId,
      } as never)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      attempt = await readAttempt();
      if (!attempt || readHash(attempt) !== hash) {
        return { ok: false, error: "This refinement conflicts with an earlier request." };
      }
      if (attempt.status === "succeeded") {
        return (await readCompleted(parsed.data.entityId, userId))
          ?? { ok: false, error: "This refinement was already completed." };
      }
      return { ok: false, error: "This refinement is already being processed." };
    }
    if (error) log.warn("ivo.tool.refinement_claim_failed", { toolKey, code: error.code });
    attemptId = (data as { id?: string } | null)?.id ?? null;
  }
  if (!attemptId) return { ok: false, error: "Ivo couldn't safely start this refinement." };

  try {
    const result = normalize(await invoke(parsed.data.entityId, parsed.data.instruction));
    await supabase
      .from("ivo_action_attempts")
      .update({
        status: result.ok ? "succeeded" : "failed",
        error_code: result.ok ? null : "REFINEMENT_REJECTED",
        output_summary: result.ok ? { completed: true } : {},
      } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    return result;
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "REFINEMENT_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.refinement_failed", {
      toolKey,
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false, error: "Ivo couldn't refine that draft." };
  }
}

async function runExplicitCreationTool<T extends { ok: boolean; error?: string }>(
  toolKey: "support.forward" | "welcome_document.save_template",
  entityType: "support_ticket" | "welcome_document_template",
  rawInput: z.input<typeof explicitCreateToolInputSchema>,
  hashPayload: unknown,
  safeInputSummary: Record<string, Json | undefined>,
  invoke: () => Promise<T>,
  resultEntityId: (result: T) => string | null,
  readCompleted: (entityId: string, userId: string) => Promise<T | null>,
): Promise<T | ToolRuntimeError> {
  assertIvoToolPath(toolKey, "approved");
  const parsed = explicitCreateToolInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "The Ivo action request is invalid." };
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false, error: "This Ivo action is no longer available." };
  const { supabase, userId } = context;
  const attemptKey = `${toolKey}:${parsed.data.requestId}`;
  const hash = createHash("sha256").update(JSON.stringify(hashPayload)).digest("hex");

  const readAttempt = async () => {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .select("id, status, input_summary, entity_id")
      .eq("user_id", userId)
      .eq("idempotency_key", attemptKey)
      .maybeSingle();
    return data as {
      id: string;
      status: string;
      input_summary: Json;
      entity_id: string | null;
    } | null;
  };
  const readHash = (attempt: Awaited<ReturnType<typeof readAttempt>>) =>
    attempt?.input_summary &&
    typeof attempt.input_summary === "object" &&
    !Array.isArray(attempt.input_summary)
      ? String(attempt.input_summary.inputHash ?? "")
      : "";

  let attempt = await readAttempt();
  if (attempt && readHash(attempt) !== hash) {
    return { ok: false, error: "This action conflicts with an earlier request." };
  }
  if (attempt?.status === "succeeded" && attempt.entity_id) {
    return (await readCompleted(attempt.entity_id, userId))
      ?? { ok: false, error: "This action was already completed." };
  }
  if (attempt?.status === "executing") {
    return { ok: false, error: "This action is already being processed." };
  }

  let attemptId: string | null = null;
  if (attempt?.status === "failed") {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .update({ status: "executing", error_code: null } as never)
      .eq("id", attempt.id)
      .eq("user_id", userId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    attemptId = (data as { id?: string } | null)?.id ?? null;
  } else if (!attempt) {
    const { data, error } = await supabase
      .from("ivo_action_attempts")
      .insert({
        conversation_id: parsed.data.conversationId,
        run_id: parsed.data.runId ?? null,
        user_id: userId,
        tool_key: toolKey,
        idempotency_key: attemptKey,
        approval_state: ivoToolApprovalState(toolKey),
        status: "executing",
        input_summary: {
          inputHash: hash,
          policy: ivoToolPolicy(toolKey),
          ...safeInputSummary,
        },
        entity_type: entityType,
      } as never)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      attempt = await readAttempt();
      if (!attempt || readHash(attempt) !== hash) {
        return { ok: false, error: "This action conflicts with an earlier request." };
      }
      if (attempt.status === "succeeded" && attempt.entity_id) {
        return (await readCompleted(attempt.entity_id, userId))
          ?? { ok: false, error: "This action was already completed." };
      }
      return { ok: false, error: "This action is already being processed." };
    }
    if (error) log.warn("ivo.tool.explicit_creation_claim_failed", { toolKey, code: error.code });
    attemptId = (data as { id?: string } | null)?.id ?? null;
  }
  if (!attemptId) return { ok: false, error: "Ivo couldn't safely start this action." };

  try {
    const result = await invoke();
    const entityId = result.ok ? resultEntityId(result) : null;
    const succeeded = result.ok && Boolean(entityId);
    await supabase
      .from("ivo_action_attempts")
      .update({
        status: succeeded ? "succeeded" : "failed",
        error_code: succeeded ? null : "CREATION_REJECTED",
        output_summary: succeeded ? { completed: true } : {},
        entity_id: entityId,
      } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    if (result.ok && !entityId) {
      return { ok: false, error: "The action completed without a result id." };
    }
    return result;
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "CREATION_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.explicit_creation_failed", {
      toolKey,
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false, error: "Ivo couldn't complete that action." };
  }
}

function normalizeFailure(value: unknown): DraftToolError {
  const raw = value as { error?: unknown; missing?: unknown; clientChoices?: unknown };
  const clientChoices = z.array(z.object({ id: z.string().uuid(), name: z.string().min(1) }))
    .safeParse(raw?.clientChoices);
  return {
    ok: false,
    error: typeof raw?.error === "string" ? raw.error : "Ivo couldn't create that draft.",
    ...(raw?.missing && typeof raw.missing === "object"
      ? { missing: raw.missing as AiMissingField }
      : {}),
    ...(clientChoices.success ? { clientChoices: clientChoices.data } : {}),
  };
}

function parseSections(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return z.array(sectionSchema).parse(parsed);
  } catch {
    return [];
  }
}

async function readInvoicePreview(entityId: string, userId: string): Promise<InvoiceRefinementSuccess | null> {
  const supabase = await getServerSupabase();
  const [{ data: invoiceRaw }, { data: lineRaw }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, client_id, currency, subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, gst_amount, tax_mode, total_amount, due_date, status, terms, notes, is_export")
      .eq("id", entityId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("description, quantity, unit_price")
      .eq("invoice_id", entityId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  const invoice = invoiceRaw as Record<string, unknown> | null;
  const line = lineRaw as Record<string, unknown> | null;
  if (!invoice || !line) return null;
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
  const preview = invoicePreviewSchema.safeParse({
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientName: client?.business_name || client?.full_name || "Selected client",
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
    description: line.description ?? "Professional services",
    quantity,
    unitPrice,
    originalSubtotal: quantity * unitPrice,
    discount: Number(invoice.discount_amount ?? 0),
    subtotal: Number(invoice.subtotal ?? 0),
    cgstAmount: Number(invoice.cgst_amount ?? 0),
    sgstAmount: Number(invoice.sgst_amount ?? 0),
    igstAmount: Number(invoice.igst_amount ?? 0),
    taxTotal: Number(invoice.gst_amount ?? 0),
    taxMode: invoice.tax_mode,
    totalAmount: Number(invoice.total_amount ?? 0),
    currency: invoice.currency,
    dueDate: invoice.due_date,
    status: invoice.status,
    terms: invoice.terms ?? null,
    notes: invoice.notes ?? null,
    isExport: Boolean(invoice.is_export),
  });
  return preview.success
    ? { ok: true, data: preview.data, message: "Invoice refinement already completed." }
    : null;
}

async function readContractPreview(entityId: string, userId: string): Promise<ContractRefinementSuccess | null> {
  const supabase = await getServerSupabase();
  const { data: contractRaw } = await supabase
    .from("contracts")
    .select("id, title, kind, client_id, project_id, value_amount, currency, content")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();
  const contract = contractRaw as Record<string, unknown> | null;
  if (!contract) return null;
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
  const preview = contractPreviewSchema.safeParse({
    id: contract.id,
    title: contract.title,
    kind: contract.kind,
    clientName: client?.business_name || client?.full_name || "Selected client",
    clientEmail: client?.email ?? null,
    projectName: project?.name ?? null,
    valueAmount: contract.value_amount == null ? null : Number(contract.value_amount),
    currency: contract.currency,
    sections: parseSections(contract.content as string | null),
    isInternational: Boolean(client?.is_foreign),
  });
  return preview.success
    ? { ok: true, data: preview.data, message: "Contract refinement already completed." }
    : null;
}

async function readWelcomePreview(entityId: string, userId: string): Promise<WelcomeRefinementSuccess | null> {
  const supabase = await getServerSupabase();
  const { data: documentRaw } = await supabase
    .from("welcome_documents")
    .select("id, title, intro, content, client_id, project_id")
    .eq("id", entityId)
    .eq("user_id", userId)
    .maybeSingle();
  const document = documentRaw as Record<string, unknown> | null;
  if (!document) return null;
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
  const preview = welcomePreviewSchema.safeParse({
    id: document.id,
    title: document.title,
    intro: document.intro ?? null,
    sections: parseSections(document.content as string | null),
    clientName: client?.business_name || client?.full_name || null,
    clientEmail: client?.email ?? null,
    clientPhone: client?.phone ?? null,
    projectName: project?.name ?? null,
  });
  return preview.success
    ? { ok: true, data: preview.data, message: "Welcome document refinement already completed." }
    : null;
}

async function readUnbilledInvoicePreview(
  entityId: string,
  userId: string,
): Promise<Extract<UnbilledInvoiceToolResult, { ok: true }> | null> {
  const supabase = await getServerSupabase();
  const [{ data: invoiceRaw }, lineResult, { data: timeRows }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, client_id, total_amount, currency")
      .eq("id", entityId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", entityId),
    supabase
      .from("time_entries")
      .select("duration_seconds")
      .eq("invoice_id", entityId)
      .eq("user_id", userId),
  ]);
  const invoice = invoiceRaw as Record<string, unknown> | null;
  if (!invoice) return null;
  const { data: clientRaw } = invoice.client_id
    ? await supabase
        .from("clients")
        .select("full_name, business_name")
        .eq("id", String(invoice.client_id))
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null };
  const client = clientRaw as Record<string, unknown> | null;
  const seconds = ((timeRows as Array<{ duration_seconds?: number | null }> | null) ?? [])
    .reduce((sum, row) => sum + Number(row.duration_seconds ?? 0), 0);
  const preview = unbilledInvoicePreviewSchema.safeParse({
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    clientName: client?.business_name || client?.full_name || "your client",
    totalAmount: Number(invoice.total_amount ?? 0),
    currency: invoice.currency,
    hours: Math.round((seconds / 3600) * 100) / 100,
    lineCount: lineResult.count ?? 0,
  });
  return preview.success
    ? { ok: true, data: preview.data, message: "Unbilled-time invoice already created." }
    : null;
}

async function runApprovedStatusTool<T extends { ok: boolean; error?: string }>(
  toolKey:
    | "invoice.approve"
    | "invoice.mark_paid"
    | "welcome_document.publish"
    | "invoice.whatsapp_prepare"
    | "contract.whatsapp_prepare"
    | "welcome_document.whatsapp_prepare",
  entityType: "invoice" | "contract" | "welcome_document",
  rawInput: z.input<typeof statusToolInputSchema>,
  invoke: (entityId: string) => Promise<T>,
  readCompleted: (entityId: string, userId: string) => Promise<T | null>,
): Promise<T | ToolRuntimeError> {
  assertIvoToolPath(toolKey, "approved");
  const parsed = statusToolInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "The Ivo status action is invalid." };
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false, error: "This Ivo action is no longer available." };
  const { supabase, userId } = context;
  const requestKey = `${toolKey}:${parsed.data.entityId}`;
  const hash = createHash("sha256").update(requestKey).digest("hex");

  const readAttempt = async () => {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .select("id, status, entity_id")
      .eq("user_id", userId)
      .eq("idempotency_key", requestKey)
      .maybeSingle();
    return data as { id: string; status: string; entity_id: string | null } | null;
  };

  let attempt = await readAttempt();
  if (attempt?.status === "succeeded") {
    return (await readCompleted(parsed.data.entityId, userId))
      ?? { ok: false, error: "This action was already completed." };
  }
  if (attempt?.status === "executing") {
    return { ok: false, error: "This action is already being processed." };
  }

  let attemptId: string | null = null;
  if (attempt?.status === "failed") {
    const { data: retried } = await supabase
      .from("ivo_action_attempts")
      .update({ status: "executing", error_code: null } as never)
      .eq("id", attempt.id)
      .eq("user_id", userId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    attemptId = (retried as { id?: string } | null)?.id ?? null;
  } else if (!attempt) {
    const { data: inserted, error: insertError } = await supabase
      .from("ivo_action_attempts")
      .insert({
        conversation_id: parsed.data.conversationId,
        run_id: parsed.data.runId ?? null,
        user_id: userId,
        tool_key: toolKey,
        idempotency_key: requestKey,
        approval_state: ivoToolApprovalState(toolKey),
        status: "executing",
        input_summary: { inputHash: hash, policy: ivoToolPolicy(toolKey) },
        entity_type: entityType,
        entity_id: parsed.data.entityId,
      } as never)
      .select("id")
      .maybeSingle();
    if (insertError?.code === "23505") {
      attempt = await readAttempt();
      if (attempt?.status === "succeeded") {
        return (await readCompleted(parsed.data.entityId, userId))
          ?? { ok: false, error: "This action was already completed." };
      }
      return { ok: false, error: "This action is already being processed." };
    }
    if (insertError) {
      log.warn("ivo.tool.status_claim_failed", { toolKey, code: insertError.code });
    }
    attemptId = (inserted as { id?: string } | null)?.id ?? null;
  }

  if (!attemptId) return { ok: false, error: "Ivo couldn't safely start this action." };
  try {
    const result = await invoke(parsed.data.entityId);
    await supabase
      .from("ivo_action_attempts")
      .update({
        status: result.ok ? "succeeded" : "failed",
        error_code: result.ok ? null : "TOOL_REJECTED",
        output_summary: result.ok ? { completed: true } : {},
      } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    return result;
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "TOOL_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.status_execution_failed", {
      toolKey,
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false, error: "Ivo couldn't complete that status change." };
  }
}

async function runApprovedEmailTool(
  toolKey: "invoice.email" | "contract.email" | "welcome_document.email",
  entityType: "invoice" | "contract" | "welcome_document",
  rawInput: z.input<typeof deliveryToolInputSchema>,
  invoke: (entityId: string, requestId: string) => Promise<{ ok: boolean; error?: string }>,
) {
  assertIvoToolPath(toolKey, "approved");
  const parsed = deliveryToolInputSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false as const, error: "The Ivo delivery request is invalid." };
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false as const, error: "This Ivo delivery is no longer available." };
  const { supabase, userId } = context;
  const attemptKey = `${toolKey}:${parsed.data.requestId}`;
  const inputHash = createHash("sha256")
    .update(`${toolKey}:${parsed.data.entityId}:${parsed.data.requestId}`)
    .digest("hex");

  const { data: existingRaw } = await supabase
    .from("ivo_action_attempts")
    .select("id, status, input_summary")
    .eq("user_id", userId)
    .eq("idempotency_key", attemptKey)
    .maybeSingle();
  const existing = existingRaw as { id: string; status: string; input_summary: Json } | null;
  const existingHash =
    existing?.input_summary &&
    typeof existing.input_summary === "object" &&
    !Array.isArray(existing.input_summary)
      ? String(existing.input_summary.inputHash ?? "")
      : "";
  if (existing && existingHash !== inputHash) {
    return { ok: false as const, error: "This delivery request conflicts with an earlier action." };
  }
  if (existing?.status === "succeeded") {
    return { ok: true as const, message: "This delivery was already completed." };
  }
  if (existing?.status === "executing") {
    return { ok: false as const, error: "This delivery is already being processed." };
  }

  let attemptId: string | null = null;
  if (existing?.status === "failed") {
    const { data: claimed } = await supabase
      .from("ivo_action_attempts")
      .update({ status: "executing", error_code: null } as never)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    attemptId = (claimed as { id?: string } | null)?.id ?? null;
  } else {
    const { data: inserted, error } = await supabase
      .from("ivo_action_attempts")
      .insert({
        conversation_id: parsed.data.conversationId,
        run_id: parsed.data.runId ?? null,
        user_id: userId,
        tool_key: toolKey,
        idempotency_key: attemptKey,
        approval_state: ivoToolApprovalState(toolKey),
        status: "executing",
        input_summary: { inputHash, policy: ivoToolPolicy(toolKey) },
        entity_type: entityType,
        entity_id: parsed.data.entityId,
      } as never)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      return { ok: false as const, error: "This delivery is already being processed." };
    }
    if (error) log.warn("ivo.tool.delivery_claim_failed", { toolKey, code: error.code });
    attemptId = (inserted as { id?: string } | null)?.id ?? null;
  }
  if (!attemptId) return { ok: false as const, error: "Ivo couldn't safely start this delivery." };

  try {
    const result = await invoke(parsed.data.entityId, parsed.data.requestId);
    await supabase
      .from("ivo_action_attempts")
      .update({
        status: result.ok ? "succeeded" : "failed",
        error_code: result.ok ? null : "DELIVERY_FAILED",
        output_summary: result.ok ? { completed: true } : {},
      } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    return result.ok
      ? { ok: true as const, message: "Delivery completed." }
      : { ok: false as const, error: result.error ?? "Delivery failed." };
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "DELIVERY_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.delivery_execution_failed", {
      toolKey,
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false as const, error: "Ivo couldn't complete that delivery." };
  }
}

export async function createClientIvoToolAction(input: ToolInput) {
  const result = await runCreateTool<ClientToolResult>(
    "client.create",
    "client",
    input,
    (value) => createClientFromAiAction(value),
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, business_name, email, phone")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as {
        id: string;
        full_name: string;
        business_name: string | null;
        email: string | null;
        phone: string | null;
      } | null;
      const parsed = cachedClientSchema.safeParse(row && {
        id: row.id,
        fullName: row.full_name,
        businessName: row.business_name ?? "",
        email: row.email ?? "",
        phone: row.phone ?? "",
      });
      return parsed.success
        ? { ok: true as const, data: parsed.data, message: undefined }
        : null;
    },
  );
  if (result.ok) {
    return {
      ...result,
      response: entityResponse("result", "Client created.", {
        type: "entity_result",
        entityType: "client",
        entityId: result.data.id,
      }),
    };
  }
  if ("needsConfirm" in result && result.needsConfirm) {
    return {
      ...result,
      response: confirmationResponse(input.idempotencyKey, result.summary.title),
    };
  }
  return result;
}

export async function createProjectIvoToolAction(input: ToolInput) {
  const result = await runCreateTool<ProjectToolResult>(
    "project.create",
    "project",
    input,
    (value) => createProjectFromAiAction(value),
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const parsed = cachedProjectSchema.safeParse(data);
      return parsed.success
        ? { ok: true as const, data: parsed.data, message: undefined }
        : null;
    },
  );
  if (result.ok) {
    return {
      ...result,
      response: entityResponse("result", "Project created.", {
        type: "entity_result",
        entityType: "project",
        entityId: result.data.id,
      }),
    };
  }
  if ("needsConfirm" in result && result.needsConfirm) {
    return {
      ...result,
      response: confirmationResponse(input.idempotencyKey, result.summary.title),
    };
  }
  return result;
}

export async function createTimeEntryIvoToolAction(input: ToolInput) {
  const result = await runCreateTool<TimeEntryToolResult>(
    "time_entry.create",
    "time_entry",
    input,
    (value) => createTimeEntryFromAiAction(value),
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("time_entries")
        .select("id, description, duration_seconds, billable, hourly_rate")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as {
        id: string;
        description: string;
        duration_seconds: number;
        billable: boolean;
        hourly_rate: number;
      } | null;
      const duration = Number(row?.duration_seconds ?? 0);
      const parsed = cachedTimeEntrySchema.safeParse(row && {
        id: row.id,
        description: row.description,
        hours: Math.floor(duration / 3600),
        minutes: Math.round((duration % 3600) / 60),
        billable: row.billable,
        hourlyRate: Number(row.hourly_rate ?? 0),
      });
      return parsed.success
        ? { ok: true as const, data: parsed.data, message: "Action already completed." }
        : null;
    },
  );
  if (result.ok) {
    return {
      ...result,
      response: entityResponse("result", "Time entry logged.", {
        type: "entity_result",
        entityType: "time_entry",
        entityId: result.data.id,
      }),
    };
  }
  if ("needsConfirm" in result && result.needsConfirm) {
    return {
      ...result,
      response: confirmationResponse(input.idempotencyKey, result.summary.title),
    };
  }
  return result;
}

export async function createInvoiceDraftIvoToolAction(
  input: ToolInput,
) {
  const result = await runImmediateDraftTool(
    "invoice.draft",
    "invoice",
    input,
    (value) => createInvoiceFromAiAction(value),
    (value) => {
      const raw = value as { ok?: boolean; data?: { preview?: unknown } };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = invoicePreviewSchema.safeParse(raw.data?.preview);
      return preview.success
        ? { ok: true, data: { preview: preview.data }, message: "Invoice draft created." }
        : { ok: false, error: "The invoice draft response was invalid." };
    },
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const [{ data: invoiceRaw }, { data: lineRaw }] = await Promise.all([
        supabase
          .from("invoices")
          .select("id, invoice_number, client_id, currency, subtotal, discount_amount, cgst_amount, sgst_amount, igst_amount, gst_amount, tax_mode, total_amount, due_date, status, terms, notes, is_export")
          .eq("id", entityId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("invoice_items")
          .select("description, quantity, unit_price")
          .eq("invoice_id", entityId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      const invoice = invoiceRaw as Record<string, unknown> | null;
      const line = lineRaw as Record<string, unknown> | null;
      if (!invoice || !line) return null;
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
      const preview = invoicePreviewSchema.safeParse({
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: client?.business_name || client?.full_name || "Selected client",
        clientEmail: client?.email ?? null,
        clientPhone: client?.phone ?? null,
        description: line.description ?? "Professional services",
        quantity,
        unitPrice,
        originalSubtotal: quantity * unitPrice,
        discount: Number(invoice.discount_amount ?? 0),
        subtotal: Number(invoice.subtotal ?? 0),
        cgstAmount: Number(invoice.cgst_amount ?? 0),
        sgstAmount: Number(invoice.sgst_amount ?? 0),
        igstAmount: Number(invoice.igst_amount ?? 0),
        taxTotal: Number(invoice.gst_amount ?? 0),
        taxMode: invoice.tax_mode,
        totalAmount: Number(invoice.total_amount ?? 0),
        currency: invoice.currency,
        dueDate: invoice.due_date,
        status: invoice.status,
        terms: invoice.terms ?? null,
        notes: invoice.notes ?? null,
        isExport: Boolean(invoice.is_export),
      });
      return preview.success
        ? { ok: true, data: { preview: preview.data }, message: "Invoice draft created." }
        : null;
    },
  );
  if (!result.ok) return result;
  return {
    ...result,
    response: entityResponse("preview", "Invoice draft ready for review.", {
      type: "entity_preview",
      entityType: "invoice",
      entityId: result.data.preview.id,
      variant: "draft",
    }),
  };
}

export async function createUnbilledTimeInvoiceIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  requestId: string;
  clientId?: string;
}): Promise<UnbilledInvoiceToolResult> {
  const clientId = input.clientId?.trim();
  if (clientId && !z.string().uuid().safeParse(clientId).success) {
    return { ok: false, error: "The selected client is invalid." };
  }
  return runImmediateDraftTool(
    "invoice.unbilled_draft",
    "invoice",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      idempotencyKey: input.requestId,
      fields: {},
      clientId,
      confirm: false,
    },
    (value) => invoiceUnbilledTimeFromAiAction({ clientId: value.clientId }),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = unbilledInvoicePreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Unbilled-time invoice created." }
        : { ok: false, error: "The unbilled-time invoice response was invalid." };
    },
    readUnbilledInvoicePreview,
  );
}

export async function createMeetingDraftIvoToolAction(input: ToolInput) {
  const res = await createMeetingFromAiAction({
    fields: input.fields,
    clientId: input.clientId,
    projectId: input.projectId,
  });
  if (!res.ok) return res;
  return { ok: true as const, kind: "meeting" as const, meeting: res.data };
}

export async function createProposalDraftIvoToolAction(input: ToolInput) {
  const res = await createProposalFromAiAction({
    fields: input.fields,
    clientId: input.clientId,
    projectId: input.projectId,
  });
  if (!res.ok) return res;
  return { ok: true as const, kind: "proposal" as const, proposal: res.data };
}

export async function createContractDraftIvoToolAction(
  input: ToolInput,
) {
  // Proposals are their own document type: create a real proposal in the
  // Proposals feature (its own table + builder) instead of a contract row.
  const typeField = String(
    (input.fields as Record<string, string> | undefined)?.type ?? "",
  );
  if (/proposal/i.test(typeField)) {
    const proposal = await createProposalFromAiAction({
      fields: input.fields,
      clientId: input.clientId,
      projectId: input.projectId,
    });
    if (!proposal.ok) return proposal;
    return { ok: true as const, kind: "proposal" as const, proposal: proposal.data };
  }

  const result = await runImmediateDraftTool(
    "contract.draft",
    "contract",
    input,
    (value) => createContractFromAiAction(value),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = contractPreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Contract draft created." }
        : { ok: false, error: "The contract draft response was invalid." };
    },
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data: contractRaw } = await supabase
        .from("contracts")
        .select("id, title, kind, client_id, project_id, value_amount, currency, content")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const contract = contractRaw as Record<string, unknown> | null;
      if (!contract) return null;
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
      const preview = contractPreviewSchema.safeParse({
        id: contract.id,
        title: contract.title,
        kind: contract.kind,
        clientName: client?.business_name || client?.full_name || "Selected client",
        clientEmail: client?.email ?? null,
        projectName: project?.name ?? null,
        valueAmount: contract.value_amount == null ? null : Number(contract.value_amount),
        currency: contract.currency,
        sections: parseSections(contract.content as string | null),
        isInternational: Boolean(client?.is_foreign),
      });
      return preview.success
        ? { ok: true, data: preview.data, message: "Contract draft created." }
        : null;
    },
  );
  if (!result.ok) return result;
  return {
    ...result,
    response: entityResponse("preview", "Contract draft ready for review.", {
      type: "entity_preview",
      entityType: "contract",
      entityId: result.data.id,
      variant: "draft",
    }),
  };
}

export async function createWelcomeDraftIvoToolAction(
  input: ToolInput,
) {
  const result = await runImmediateDraftTool(
    "welcome_document.draft",
    "welcome_document",
    input,
    (value) => createWelcomeDocFromAiAction(value),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = welcomePreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Welcome document draft created." }
        : { ok: false, error: "The welcome document draft response was invalid." };
    },
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data: documentRaw } = await supabase
        .from("welcome_documents")
        .select("id, title, intro, content, client_id, project_id")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const document = documentRaw as Record<string, unknown> | null;
      if (!document) return null;
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
      const preview = welcomePreviewSchema.safeParse({
        id: document.id,
        title: document.title,
        intro: document.intro ?? null,
        sections: parseSections(document.content as string | null),
        clientName: client?.business_name || client?.full_name || null,
        clientEmail: client?.email ?? null,
        clientPhone: client?.phone ?? null,
        projectName: project?.name ?? null,
      });
      return preview.success
        ? { ok: true, data: preview.data, message: "Welcome document draft created." }
        : null;
    },
  );
  if (!result.ok) return result;
  return {
    ...result,
    response: entityResponse("preview", "Welcome document draft ready for review.", {
      type: "entity_preview",
      entityType: "welcome_document",
      entityId: result.data.id,
      variant: "draft",
    }),
  };
}

export async function refineInvoiceIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
  requestId: string;
  instruction: string;
}): Promise<InvoiceRefinementToolResult & { response?: IvoToolResponseDescriptor }> {
  const result = await runRefinementTool<InvoiceRefinementSuccess>(
    "invoice.refine",
    "invoice",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.invoiceId,
      requestId: input.requestId,
      instruction: input.instruction,
    },
    (invoiceId, instruction) => refineInvoiceFromAiAction({ invoiceId, instruction }),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = invoicePreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Invoice updated." }
        : { ok: false, error: "The refined invoice response was invalid." };
    },
    readInvoicePreview,
  );
  return withResponse(result, () =>
    entityResponse("preview", "Invoice updated.", {
      type: "entity_preview",
      entityType: "invoice",
      entityId: input.invoiceId,
      variant: "draft",
    }),
  );
}

export async function refineContractIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  contractId: string;
  requestId: string;
  instruction: string;
}): Promise<ContractRefinementToolResult & { response?: IvoToolResponseDescriptor }> {
  const result = await runRefinementTool<ContractRefinementSuccess>(
    "contract.refine",
    "contract",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.contractId,
      requestId: input.requestId,
      instruction: input.instruction,
    },
    (contractId, instruction) => refineContractFromAiAction({ contractId, instruction }),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = contractPreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Contract updated." }
        : { ok: false, error: "The refined contract response was invalid." };
    },
    readContractPreview,
  );
  return withResponse(result, () =>
    entityResponse(
      "preview",
      result.ok && result.data.kind === "proposal" ? "Proposal updated." : "Contract updated.",
      {
        type: "entity_preview",
        entityType: "contract",
        entityId: input.contractId,
        variant: "draft",
      },
    ),
  );
}

export async function refineWelcomeDocumentIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  welcomeDocId: string;
  requestId: string;
  instruction: string;
}): Promise<WelcomeRefinementToolResult & { response?: IvoToolResponseDescriptor }> {
  const result = await runRefinementTool<WelcomeRefinementSuccess>(
    "welcome_document.refine",
    "welcome_document",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.welcomeDocId,
      requestId: input.requestId,
      instruction: input.instruction,
    },
    (welcomeDocId, instruction) => refineWelcomeDocFromAiAction({ welcomeDocId, instruction }),
    (value) => {
      const raw = value as { ok?: boolean; data?: unknown };
      if (!raw?.ok) return normalizeFailure(value);
      const preview = welcomePreviewSchema.safeParse(raw.data);
      return preview.success
        ? { ok: true, data: preview.data, message: "Welcome document updated." }
        : { ok: false, error: "The refined welcome document response was invalid." };
    },
    readWelcomePreview,
  );
  return withResponse(result, () =>
    entityResponse("preview", "Welcome document updated.", {
      type: "entity_preview",
      entityType: "welcome_document",
      entityId: input.welcomeDocId,
      variant: "draft",
    }),
  );
}

export async function approveInvoiceIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
}) {
  const result = await runApprovedStatusTool(
    "invoice.approve",
    "invoice",
    { conversationId: input.conversationId, runId: input.runId, entityId: input.invoiceId },
    (invoiceId) => approveInvoiceFromAiAction({ invoiceId }),
    async (invoiceId, userId) => {
      const supabase = await getServerSupabase();
      const { data: invoiceRaw } = await supabase
        .from("invoices")
        .select("id, invoice_number, currency, total_amount, due_date, status, client_id")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .maybeSingle();
      const invoice = invoiceRaw as Record<string, unknown> | null;
      if (!invoice) return null;
      const { data: clientRaw } = invoice.client_id
        ? await supabase
            .from("clients")
            .select("full_name, business_name, email, phone")
            .eq("id", String(invoice.client_id))
            .eq("user_id", userId)
            .maybeSingle()
        : { data: null };
      const client = clientRaw as Record<string, unknown> | null;
      return {
        ok: true as const,
        message: "Invoice approved and marked as sent.",
        data: {
          id: String(invoice.id),
          invoiceNumber: String(invoice.invoice_number),
          totalAmount: Number(invoice.total_amount) || 0,
          currency: String(invoice.currency),
          dueDate: String(invoice.due_date),
          status: String(invoice.status),
          clientName: client?.business_name || client?.full_name
            ? String(client?.business_name || client?.full_name)
            : null,
          clientEmail: client?.email ? String(client.email) : null,
          clientPhone: client?.phone ? String(client.phone) : null,
        },
      };
    },
  );
  return withResponse(result, () =>
    entityResponse("preview", "Invoice approved and ready for delivery.", {
      type: "entity_preview",
      entityType: "invoice",
      entityId: input.invoiceId,
      variant: "delivery",
    }),
  );
}

export async function emailInvoiceIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
  requestId: string;
}) {
  const result = await runApprovedEmailTool(
    "invoice.email",
    "invoice",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.invoiceId,
      requestId: input.requestId,
    },
    (invoiceId, requestId) => emailInvoiceFromAiAction({ invoiceId, idempotencyKey: requestId }),
  );
  return withResponse(result, () => outcomeResponse("Done. Invoice emailed to the client."));
}

export async function emailContractIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  contractId: string;
  requestId: string;
}) {
  const result = await runApprovedEmailTool(
    "contract.email",
    "contract",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.contractId,
      requestId: input.requestId,
    },
    (contractId, requestId) => sendContractFromAiAction({ contractId, idempotencyKey: requestId }),
  );
  return withResponse(result, async () =>
    outcomeResponse(await describeContractDelivery(input.conversationId, input.contractId)),
  );
}

/**
 * Builds contract delivery copy from the canonical record, so the panel never
 * has to infer proposal-vs-contract wording or the recipient from a preview it
 * may have been holding since before the document was edited.
 */
async function describeContractDelivery(conversationId: string, contractId: string) {
  const context = await requireOwnedContext(conversationId);
  if (!context) return "Contract sent to the client.";
  const { supabase, userId } = context;
  const { data } = await supabase
    .from("contracts")
    .select("kind, client_id")
    .eq("id", contractId)
    .eq("user_id", userId)
    .maybeSingle();
  const contract = data as { kind?: string | null; client_id?: string | null } | null;
  const label = contract?.kind === "proposal" ? "Proposal" : "Contract";
  if (!contract?.client_id) return `${label} sent to the client.`;
  const { data: clientRaw } = await supabase
    .from("clients")
    .select("email")
    .eq("id", contract.client_id)
    .eq("user_id", userId)
    .maybeSingle();
  const email = (clientRaw as { email?: string | null } | null)?.email;
  return `${label} sent to ${email || "the client"}.`;
}

export async function emailWelcomeDocumentIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  welcomeDocId: string;
  requestId: string;
}) {
  const result = await runApprovedEmailTool(
    "welcome_document.email",
    "welcome_document",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.welcomeDocId,
      requestId: input.requestId,
    },
    (welcomeDocId, requestId) => sendWelcomeDocFromAiAction({
      welcomeDocId,
      idempotencyKey: requestId,
    }),
  );
  return withResponse(result, () =>
    outcomeResponse("Done. Welcome document emailed to the client."),
  );
}

export async function markInvoicePaidIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
}) {
  const result = await runApprovedStatusTool(
    "invoice.mark_paid",
    "invoice",
    { conversationId: input.conversationId, runId: input.runId, entityId: input.invoiceId },
    (invoiceId) => markInvoicePaidFromAiAction({ invoiceId }),
    async (invoiceId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("invoices")
        .select("id, status")
        .eq("id", invoiceId)
        .eq("user_id", userId)
        .maybeSingle();
      const invoice = data as { id: string; status: string } | null;
      return invoice?.status === "paid"
        ? { ok: true as const, data: { invoiceId: invoice.id } }
        : null;
    },
  );
  return withResponse(result, () => outcomeResponse("Invoice marked as paid."));
}

export async function publishWelcomeDocumentIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  welcomeDocId: string;
}) {
  const result = await runApprovedStatusTool(
    "welcome_document.publish",
    "welcome_document",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.welcomeDocId,
    },
    (welcomeDocId) => approveWelcomeDocFromAiAction({ welcomeDocId }),
    async (welcomeDocId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("welcome_documents")
        .select("id, status")
        .eq("id", welcomeDocId)
        .eq("user_id", userId)
        .maybeSingle();
      const document = data as { status: string } | null;
      return document?.status === "published"
        ? { ok: true as const, message: "Welcome document published." }
        : null;
    },
  );
  return withResponse(result, () =>
    entityResponse("preview", "Welcome document published and ready for delivery.", {
      type: "entity_preview",
      entityType: "welcome_document",
      entityId: input.welcomeDocId,
      variant: "delivery",
    }),
  );
}

export async function prepareInvoiceWhatsAppIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
}) {
  const result = await runApprovedStatusTool(
    "invoice.whatsapp_prepare",
    "invoice",
    { conversationId: input.conversationId, runId: input.runId, entityId: input.invoiceId },
    (invoiceId) => invoiceWhatsappFromAiAction({ invoiceId }),
    async (invoiceId) => invoiceWhatsappFromAiAction({ invoiceId }),
  );
  return withResponse(result, () =>
    outcomeResponse("WhatsApp is open with the invoice link ready to send."),
  );
}

/**
 * Delivers an approved invoice over one or both channels.
 *
 * The panel used to run this sequence itself: email, check, then prepare the
 * WhatsApp share, then stitch the two outcome sentences together. That put a
 * domain ordering decision — the formal emailed record goes out before the
 * informal nudge — in the client, where a partial failure between the two steps
 * had no single owner. Sequencing and the merged outcome copy now live here.
 *
 * This composes the two audited tools rather than replacing them, so each
 * channel keeps its own ledger attempt and idempotency barrier. Opening the
 * WhatsApp window is still the caller's job; only the URL crosses back.
 */
export async function deliverInvoiceIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  invoiceId: string;
  channel: "email" | "whatsapp" | "both";
  requestId: string;
}): Promise<
  | { ok: true; whatsappUrl?: string; response: IvoToolResponseDescriptor }
  | { ok: false; error: string }
> {
  const outcomes: string[] = [];

  if (input.channel === "email" || input.channel === "both") {
    const emailed = await emailInvoiceIvoToolAction({
      conversationId: input.conversationId,
      runId: input.runId,
      invoiceId: input.invoiceId,
      requestId: input.requestId,
    });
    // A failed email stops the sequence. Opening WhatsApp after the client was
    // told the invoice went out would misreport what actually happened.
    if (!emailed.ok) return { ok: false, error: emailed.error };
    if (emailed.response) outcomes.push(emailed.response.content);
  }

  let whatsappUrl: string | undefined;
  if (input.channel === "whatsapp" || input.channel === "both") {
    const shared = await prepareInvoiceWhatsAppIvoToolAction({
      conversationId: input.conversationId,
      runId: input.runId,
      invoiceId: input.invoiceId,
    });
    if (!shared.ok) return { ok: false, error: shared.error };
    whatsappUrl = shared.data.url;
    if (shared.response) outcomes.push(shared.response.content);
  }

  return {
    ok: true,
    whatsappUrl,
    response: outcomeResponse(outcomes.join(" ") || "Invoice delivery completed."),
  };
}

export async function prepareContractWhatsAppIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  contractId: string;
}) {
  const result = await runApprovedStatusTool(
    "contract.whatsapp_prepare",
    "contract",
    { conversationId: input.conversationId, runId: input.runId, entityId: input.contractId },
    (contractId) => contractWhatsappFromAiAction({ contractId }),
    async (contractId) => contractWhatsappFromAiAction({ contractId }),
  );
  return withResponse(result, async () => {
    const label = await readContractLabel(input.conversationId, input.contractId);
    return outcomeResponse(`WhatsApp is open with the ${label} link ready to send.`);
  });
}

/** Resolves proposal-vs-contract wording from the canonical record. */
async function readContractLabel(conversationId: string, contractId: string) {
  const context = await requireOwnedContext(conversationId);
  if (!context) return "contract";
  const { data } = await context.supabase
    .from("contracts")
    .select("kind")
    .eq("id", contractId)
    .eq("user_id", context.userId)
    .maybeSingle();
  return (data as { kind?: string | null } | null)?.kind === "proposal" ? "proposal" : "contract";
}

export async function prepareWelcomeWhatsAppIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  welcomeDocId: string;
}) {
  const result = await runApprovedStatusTool(
    "welcome_document.whatsapp_prepare",
    "welcome_document",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      entityId: input.welcomeDocId,
    },
    (welcomeDocId) => welcomeDocWhatsappFromAiAction({ welcomeDocId }),
    async (welcomeDocId) => welcomeDocWhatsappFromAiAction({ welcomeDocId }),
  );
  return withResponse(result, () =>
    outcomeResponse("WhatsApp is open with the welcome document link ready to send."),
  );
}

export async function remindOverdueInvoicesIvoToolAction(input: {
  conversationId: string;
  runId?: string;
}) {
  const parsed = statusToolInputSchema.pick({ conversationId: true, runId: true }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "The reminder request is invalid." };
  const context = await requireOwnedContext(parsed.data.conversationId, parsed.data.runId);
  if (!context) return { ok: false as const, error: "This reminder action is no longer available." };
  const { supabase, userId } = context;
  const day = new Date().toISOString().slice(0, 10);
  const attemptKey = `invoice.remind_overdue:${day}`;

  const { data: existingRaw } = await supabase
    .from("ivo_action_attempts")
    .select("id, status, output_summary")
    .eq("user_id", userId)
    .eq("idempotency_key", attemptKey)
    .maybeSingle();
  const existing = existingRaw as { id: string; status: string; output_summary: Json } | null;
  if (existing?.status === "succeeded") {
    const output = existing.output_summary && typeof existing.output_summary === "object"
      && !Array.isArray(existing.output_summary)
      ? existing.output_summary
      : {};
    return {
      ok: true as const,
      data: {
        sent: Number(output.sent ?? 0),
        skipped: Number(output.skipped ?? 0),
        total: Number(output.total ?? 0),
        amount: 0,
      },
    };
  }
  if (existing?.status === "executing") {
    return { ok: false as const, error: "Overdue reminders are already being processed." };
  }

  let attemptId: string | null = null;
  if (existing?.status === "failed") {
    const { data } = await supabase
      .from("ivo_action_attempts")
      .update({ status: "executing", error_code: null } as never)
      .eq("id", existing.id)
      .eq("user_id", userId)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();
    attemptId = (data as { id?: string } | null)?.id ?? null;
  } else {
    const { data, error } = await supabase
      .from("ivo_action_attempts")
      .insert({
        conversation_id: parsed.data.conversationId,
        run_id: parsed.data.runId ?? null,
        user_id: userId,
        tool_key: "invoice.remind_overdue",
        idempotency_key: attemptKey,
        approval_state: ivoToolApprovalState("invoice.remind_overdue"),
        status: "executing",
        input_summary: { policy: ivoToolPolicy("invoice.remind_overdue"), day },
        entity_type: "invoice",
      } as never)
      .select("id")
      .maybeSingle();
    if (error?.code === "23505") {
      return { ok: false as const, error: "Overdue reminders are already being processed." };
    }
    if (error) log.warn("ivo.tool.bulk_reminder_claim_failed", { code: error.code });
    attemptId = (data as { id?: string } | null)?.id ?? null;
  }
  if (!attemptId) return { ok: false as const, error: "Ivo couldn't safely start reminders." };

  try {
    const result = await remindOverdueInvoicesFromAiAction();
    await supabase
      .from("ivo_action_attempts")
      .update({
        status: result.ok ? "succeeded" : "failed",
        error_code: result.ok ? null : "DELIVERY_FAILED",
        output_summary: result.ok
          ? {
              sent: result.data.sent,
              skipped: result.data.skipped,
              total: result.data.total,
            }
          : {},
      } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    return result;
  } catch (error) {
    await supabase
      .from("ivo_action_attempts")
      .update({ status: "failed", error_code: "DELIVERY_RUNTIME_ERROR" } as never)
      .eq("id", attemptId)
      .eq("user_id", userId);
    log.warn("ivo.tool.bulk_reminder_failed", {
      error: error instanceof Error ? error.message : "unknown",
      entity: { type: "ivo_action_attempt", id: attemptId },
    });
    return { ok: false as const, error: "Ivo couldn't send overdue reminders." };
  }
}

export async function forwardToSupportIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  requestId: string;
  message: string;
  page?: string;
}) {
  const details = z.object({
    message: z.string().trim().min(1).max(8000),
    page: z.string().max(500).optional(),
  }).safeParse({ message: input.message, page: input.page });
  if (!details.success) return { ok: false as const, error: "The support request is invalid." };
  const subject = details.data.message.slice(0, 180);
  return runExplicitCreationTool(
    "support.forward",
    "support_ticket",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      requestId: input.requestId,
    },
    { message: details.data.message, page: details.data.page ?? "" },
    {
      messageLength: details.data.message.length,
      hasPage: Boolean(details.data.page),
      category: "how-to",
    },
    () => createTicketAction({
      category: "how-to",
      subject,
      message: details.data.message,
      channel: "chat",
      page: details.data.page,
    }),
    (result) => result.ticketId ?? null,
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const ticket = data as { id?: string } | null;
      return ticket?.id ? { ok: true, ticketId: ticket.id } : null;
    },
  );
}

export async function saveWelcomeTemplateIvoToolAction(input: {
  conversationId: string;
  runId?: string;
  requestId: string;
  welcomeDocId: string;
  title: string;
}) {
  const details = z.object({
    welcomeDocId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
  }).safeParse({ welcomeDocId: input.welcomeDocId, title: input.title });
  if (!details.success) return { ok: false as const, error: "The template request is invalid." };
  const result = await runExplicitCreationTool(
    "welcome_document.save_template",
    "welcome_document_template",
    {
      conversationId: input.conversationId,
      runId: input.runId,
      requestId: input.requestId,
    },
    { welcomeDocId: details.data.welcomeDocId, title: details.data.title },
    {
      sourceEntityType: "welcome_document",
      titleLength: details.data.title.length,
    },
    () => saveAsTemplateAction({
      id: details.data.welcomeDocId,
      templateTitle: details.data.title,
    }),
    (result) => result.ok ? result.data?.id ?? null : null,
    async (entityId, userId) => {
      const supabase = await getServerSupabase();
      const { data } = await supabase
        .from("welcome_document_templates")
        .select("id")
        .eq("id", entityId)
        .eq("user_id", userId)
        .maybeSingle();
      const template = data as { id?: string } | null;
      return template?.id
        ? { ok: true, data: { id: template.id }, message: "Template already saved." }
        : null;
    },
  );
  return withResponse(result, () =>
    outcomeResponse(
      "Saved as a reusable template — you'll see it next time you create a welcome document.",
    ),
  );
}

export async function rejectIvoToolAction(input: z.input<typeof rejectToolSchema>) {
  const parsed = rejectToolSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid Ivo action." };
  const context = await requireOwnedContext(parsed.data.conversationId);
  if (!context) return { ok: false as const, error: "This Ivo action is no longer available." };

  const { error } = await context.supabase
    .from("ivo_action_attempts")
    .update({ approval_state: "rejected", status: "cancelled" } as never)
    .eq("conversation_id", parsed.data.conversationId)
    .eq("user_id", context.userId)
    .eq("idempotency_key", parsed.data.idempotencyKey)
    .eq("status", "proposed");
  if (error) {
    log.warn("ivo.tool.rejection_save_failed", { code: error.code });
    return { ok: false as const, error: "Ivo couldn't save that cancellation." };
  }
  return { ok: true as const };
}
