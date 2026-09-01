import "server-only";

import { createHash } from "node:crypto";

import { getServerSupabase } from "@/lib/supabase/server";
import type { AutomationRunRow } from "@/lib/supabase/types";
import { ivoToolApprovalState, ivoToolPolicy, type IvoToolKey } from "@/features/ai-workflows/tool-registry";
import { AUTOMATION_TRIGGER_TOOL } from "./trigger-map";
import {
  invoiceUnbilledTimeFromAiAction,
  remindInvoiceFromAiAction,
  sendProposalFromAiAction,
  sendContractFromAiAction,
} from "@/features/ai-workflows/domain-operations";

/**
 * Automation executor — Phase 4 slice 2.
 *
 * Turns an approved automation run into a typed, audited execution through the
 * Phase 3 tool registry. Crucially this is SESSION-scoped, not admin-scoped:
 * the underlying domain operations (remind, send, draft-from-unbilled) are
 * bound to `getServerSupabase()` and only make sense acting as the signed-in
 * user. The cron only MATERIALIZES queued runs; the user's approval here is
 * what executes one.
 *
 * Safety model mirrors prepared-actions and the tool runners:
 *   - The run is claimed atomically (`queued`->`running`) before anything else,
 *     so two approvals or a double-click cannot double-send.
 *   - Every run resolves against the registry: `ivoToolSpec` supplies the
 *     tool key's policy + approval state, written to `ivo_action_attempts`
 *     keyed by `automation:<runId>` (idempotent audit).
 *   - On failure the claim is released back to `queued` until `MAX_RETRIES`,
 *     so a transient error retries safely and never re-sends a completed send
 *     (a succeeded run is not re-claimed).
 */

export const MAX_RETRIES = 3;

type ActionResult = { ok: boolean; error?: string };

interface TriggerExecution {
  toolKey: IvoToolKey;
  run(input: { entityId: string | null }): Promise<ActionResult>;
}

async function requireOwnedRun(
  suggestionId: string,
): Promise<{ supabase: Awaited<ReturnType<typeof getServerSupabase>>; userId: string; run: AutomationRunRow } | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: suggestionRaw } = await supabase
    .from("automation_suggestions")
    .select("id, user_id, recipe_id, trigger_key, entity_type, entity_id, status, expires_at")
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  const suggestion = suggestionRaw as
    | {
        id: string;
        user_id: string;
        recipe_id: string | null;
        trigger_key: string;
        entity_type: string | null;
        entity_id: string | null;
        status: string;
        expires_at: string | null;
      }
    | null;
  if (!suggestion) return null;
  if (suggestion.expires_at && new Date(suggestion.expires_at).getTime() > Date.now()) return null;
  if (suggestion.recipe_id) {
    const { data: recipeRaw } = await supabase
      .from("automation_recipes")
      .select("enabled")
      .eq("id", suggestion.recipe_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!(recipeRaw as { enabled?: boolean } | null)?.enabled) return null;
  }

  // Find the queued run for this suggestion's moment. The suggestion and the
  // run share (trigger_key, entity_type, entity_id) and dedupe key is embedded
  // in metadata only on the suggestion; the run carries the moment directly.
  let q = supabase
    .from("automation_runs")
    .select("*")
    .eq("user_id", user.id)
    .eq("trigger_key", suggestion.trigger_key)
    .eq("status", "queued")
    .order("created_at", { ascending: false })
    .limit(5);
  const entityType = suggestion.entity_type ?? null;
  const entityId = suggestion.entity_id ?? null;
  if (entityId !== null) {
    q = q.eq("entity_type", entityType ?? "").eq("entity_id", entityId);
  } else {
    q = q.is("entity_id", null);
  }
  const { data: runsRaw } = await q;
  const runs = (runsRaw as unknown as AutomationRunRow[] | null) ?? [];
  const run = runs.find(
    (row) =>
      row.trigger_key === suggestion.trigger_key &&
      (row.entity_type ?? null) === (suggestion.entity_type ?? null) &&
      (row.entity_id ?? null) === (suggestion.entity_id ?? null),
  );
  if (!run) return null;

  return { supabase, userId: user.id, run };
}

/**
 * Runnable trigger executions. The tool key comes from the pure trigger-map
 * (so it stays registry-derived and eval-checkable); the closures bind the
 * session-scoped domain operations that actually perform the work.
 */
const TRIGGER_EXECUTIONS: Record<string, TriggerExecution> = {
  invoice_overdue_followup: {
    toolKey: AUTOMATION_TRIGGER_TOOL.invoice_overdue_followup,
    run: ({ entityId }) =>
      entityId
        ? remindInvoiceFromAiAction({ invoiceId: entityId })
        : Promise.resolve({ ok: false, error: "This reminder has no invoice." }),
  },
  invoice_due_soon_review: {
    toolKey: AUTOMATION_TRIGGER_TOOL.invoice_due_soon_review,
    run: ({ entityId }) =>
      entityId
        ? remindInvoiceFromAiAction({ invoiceId: entityId })
        : Promise.resolve({ ok: false, error: "This reminder has no invoice." }),
  },
  unbilled_time_invoice: {
    toolKey: AUTOMATION_TRIGGER_TOOL.unbilled_time_invoice,
    run: () => invoiceUnbilledTimeFromAiAction({}),
  },
  proposal_followup: {
    toolKey: AUTOMATION_TRIGGER_TOOL.proposal_followup,
    run: ({ entityId }) =>
      entityId
        ? sendProposalFromAiAction({ proposalId: entityId })
        : Promise.resolve({ ok: false, error: "This follow-up has no proposal." }),
  },
  contract_expiry_followup: {
    toolKey: AUTOMATION_TRIGGER_TOOL.contract_expiry_followup,
    run: ({ entityId }) =>
      entityId
        ? sendContractFromAiAction({ contractId: entityId })
        : Promise.resolve({ ok: false, error: "This follow-up has no contract." }),
  },
};

function attemptKey(runId: string): string {
  return `automation:${runId}`;
}

function inputHash(runId: string, triggerKey: string): string {
  return createHash("sha256")
    .update(`automation:${triggerKey}:${runId}:${triggerKey}`)
    .digest("hex");
}

/**
 * Execute one approved automation run. Returns a user-facing result.
 */
export async function executeAutomationRunAction(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await requireOwnedRun(input.suggestionId);
  if (!owned) {
    return { ok: false, error: "This automation is no longer available to run." };
  }
  const { supabase, userId, run } = owned;
  const execution = TRIGGER_EXECUTIONS[run.trigger_key];
  if (!execution) {
    return { ok: false, error: "This automation has no executable action." };
  }

  if (run.retry_count >= MAX_RETRIES) {
    await supabase
      .from("automation_runs")
      .update({ status: "failed" } as never)
      .eq("id", run.id)
      .eq("user_id", userId);
    return { ok: false, error: "This automation failed too many times and was stopped." };
  }

  // Claim atomically so a concurrent approval cannot double-execute.
  const { data: claimed } = await supabase
    .from("automation_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
      retry_count: (run.retry_count + 1),
    } as never)
    .eq("id", run.id)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select("id");
  if (!claimed || (claimed as unknown[]).length === 0) {
    return { ok: false, error: "This automation was already handled." };
  }

  let result: ActionResult;
  try {
    result = await execution.run({ entityId: run.entity_id });
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "execution error" };
  }

  // Audit through the registry, idempotent on (user, run) — a retried run
  // updates its own attempt row instead of stacking a second one, so the audit
  // record always reflects the latest outcome without violating the
  // (user_id, idempotency_key) uniqueness on this ledger.
  const toolKey = execution.toolKey;
  const auditKey = attemptKey(run.id);
  const isFailure = !result.ok;
  await supabase
    .from("ivo_action_attempts")
    .upsert(
      {
        user_id: userId,
        tool_key: toolKey,
        idempotency_key: auditKey,
        approval_state: ivoToolApprovalState(toolKey),
        status: isFailure ? "failed" : "succeeded",
        input_summary: { policy: ivoToolPolicy(toolKey), inputHash: inputHash(run.id, run.trigger_key) },
        output_summary: isFailure ? { error: result.error ?? "unknown" } : { completed: true },
        entity_type: run.entity_type,
        entity_id: run.entity_id,
        error_code: isFailure ? "AUTOMATION_FAILED" : null,
      } as never,
      { onConflict: "user_id,idempotency_key" },
    );

  const nextBody: Record<string, unknown> = result.ok
    ? { status: "succeeded", finished_at: new Date().toISOString() }
    : {
        status: run.retry_count + 1 < MAX_RETRIES ? "queued" : "failed",
        last_error: result.error ?? "unknown",
        error: result.error ?? "unknown",
      };
  if (!result.ok && nextBody.status === "queued") {
    nextBody.started_at = null;
  }
  if (!result.ok && nextBody.status === "failed") {
    nextBody.finished_at = new Date().toISOString();
  }

  await supabase
    .from("automation_runs")
    .update(nextBody as never)
    .eq("id", run.id)
    .eq("user_id", userId);

  if (result.ok) {
    // Convert the suggestion to approved so it no longer shows in the queue.
    await supabase
      .from("automation_suggestions")
      .update({ status: "approved", acted_at: new Date().toISOString() } as never)
      .eq("id", input.suggestionId)
      .eq("user_id", userId);
  }

  return result.ok ? { ok: true } : { ok: false, error: result.error ?? "Run failed." };
}
