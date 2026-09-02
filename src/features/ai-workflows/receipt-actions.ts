"use server";

/**
 * Reads Ivo's execution receipts for the signed-in user.
 *
 * Read-only and user-scoped. Every row is filtered by `user_id` in addition to
 * RLS, so a receipt for another workspace cannot be returned even if a policy
 * were later relaxed by mistake.
 */

import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import type { AutomationRunRow } from "@/lib/supabase/types";
import { buildIvoReceipt, type IvoExecutionReceipt, type IvoLedgerRow } from "./receipts";

export interface IvoActivityItem {
  id: string;
  kind: "read" | "action" | "automation";
  status: "succeeded" | "failed" | "cancelled" | "in_progress" | "empty" | "unavailable";
  title: string;
  detail: string | null;
  occurredAt: string;
  href: string | null;
  requiredApproval: boolean;
  approvalState: "not_required" | "required" | "approved" | "rejected";
}

const listSchema = z.object({
  /** Restrict to one conversation, or omit for the whole workspace history. */
  conversationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export async function listIvoReceiptsAction(
  input: z.input<typeof listSchema> = {},
): Promise<
  | { ok: true; data: { receipts: IvoExecutionReceipt[]; asOf: string } }
  | { ok: false; error: string }
> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid receipt request." };

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    let query = supabase
      .from("ivo_action_attempts")
      .select("id, tool_key, entity_id, status, approval_state, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.conversationId) {
      query = query.eq("conversation_id", parsed.data.conversationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const receipts = ((data as IvoLedgerRow[] | null) ?? [])
      .map(buildIvoReceipt)
      // A row referencing a tool that is no longer declared is dropped rather
      // than shown with invented metadata.
      .filter((receipt): receipt is IvoExecutionReceipt => receipt !== null);

    return { ok: true, data: { receipts, asOf: new Date().toISOString() } };
  } catch (error) {
    log.warn("ivo.receipts.read_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    // Distinguishable from "no receipts": the caller must not render an empty
    // audit trail when the read failed.
    return { ok: false, error: "Ivo couldn't read your activity just now." };
  }
}

const READ_LABELS: Record<string, string> = {
  get_business_snapshot: "Read business metrics",
  list_records: "Read workspace records",
  find_invoice: "Looked up an invoice",
  list_leads: "Read lead activity",
  list_meetings: "Read meeting activity",
  get_client_profile: "Read a client profile",
};

const AUTOMATION_LABELS: Record<string, string> = {
  invoice_overdue_followup: "Overdue invoice follow-up",
  invoice_due_soon_review: "Due-soon invoice review",
  proposal_followup: "Proposal follow-up",
  unbilled_time_invoice: "Unbilled time invoice",
  contract_expiry_followup: "Contract expiry follow-up",
};

function automationHref(run: AutomationRunRow): string | null {
  if (!run.entity_id) return run.trigger_key === "unbilled_time_invoice" ? "/dashboard/time?status=unbilled" : null;
  if (run.entity_type === "invoice") return `/dashboard/invoices/${run.entity_id}`;
  if (run.entity_type === "proposal") return `/dashboard/proposals/${run.entity_id}`;
  if (run.entity_type === "contract") return `/dashboard/contracts/${run.entity_id}`;
  return null;
}

function automationActivity(run: AutomationRunRow): IvoActivityItem {
  const requiresApproval = run.trigger_key !== "unbilled_time_invoice";
  const status: IvoActivityItem["status"] =
    run.status === "succeeded" || run.status === "failed" || run.status === "cancelled"
      ? run.status
      : "in_progress";
  const attempts = run.retry_count;
  const stateDetail =
    run.status === "queued"
      ? requiresApproval ? "Ready for your review" : "Ready to create a workspace draft"
      : run.status === "waiting_for_approval"
        ? "Waiting for your approval"
        : run.status === "running"
          ? `Running attempt ${Math.max(1, attempts)} of 3`
          : run.status === "failed"
            ? `Stopped after ${attempts} ${attempts === 1 ? "attempt" : "attempts"}`
            : run.status === "cancelled"
              ? "Dismissed or no longer needed"
              : "Completed and verified";
  return {
    id: `automation:${run.id}`,
    kind: "automation",
    status,
    title: AUTOMATION_LABELS[run.trigger_key] ?? "Automation run",
    detail: run.reason ? `${stateDetail} · ${run.reason.slice(0, 140)}` : stateDetail,
    occurredAt: run.finished_at ?? run.started_at ?? run.updated_at ?? run.created_at,
    href: automationHref(run),
    requiredApproval: requiresApproval,
    approvalState: requiresApproval
      ? run.status === "queued" || run.status === "waiting_for_approval"
        ? "required"
        : run.status === "cancelled"
          ? "rejected"
          : "approved"
      : "not_required",
  };
}

export async function listIvoActivityAction(
  input: z.input<typeof listSchema> = {},
): Promise<
  | { ok: true; data: { items: IvoActivityItem[]; asOf: string } }
  | { ok: false; error: string }
> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid activity request." };
  try {
    const supabase = await getServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    let attemptsQuery = supabase
      .from("ivo_action_attempts")
      .select("id, tool_key, entity_id, status, approval_state, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    let runsQuery = supabase
      .from("ivo_runs")
      .select("id, status, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    const automationRunsQuery = supabase
      .from("automation_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.conversationId) {
      attemptsQuery = attemptsQuery.eq("conversation_id", parsed.data.conversationId);
      runsQuery = runsQuery.eq("conversation_id", parsed.data.conversationId);
    }
    const [attemptsResult, runsResult, automationRunsResult] = await Promise.all([
      attemptsQuery,
      runsQuery,
      automationRunsQuery,
    ]);
    if (attemptsResult.error) throw attemptsResult.error;
    if (runsResult.error) throw runsResult.error;
    if (automationRunsResult.error) throw automationRunsResult.error;

    const actionItems = ((attemptsResult.data as IvoLedgerRow[] | null) ?? [])
      .map(buildIvoReceipt)
      .filter((receipt): receipt is IvoExecutionReceipt => receipt !== null)
      .map((receipt): IvoActivityItem => ({
        id: `action:${receipt.id}`,
        kind: "action",
        status: receipt.status,
        title: receipt.summary,
        detail:
          receipt.status === "in_progress" && receipt.approvalState === "required"
            ? "Waiting for your approval"
            : receipt.status === "failed"
              ? "The action did not complete"
              : receipt.status === "cancelled"
                ? "No change was completed"
                : receipt.status === "succeeded" && receipt.requiredApproval
                  ? "Approved and verified"
                  : receipt.status === "succeeded"
                    ? "Verified from workspace"
                    : "In progress",
        occurredAt: receipt.occurredAt,
        href: receipt.href,
        requiredApproval: receipt.requiredApproval,
        approvalState: receipt.approvalState,
      }));

    const readItems = ((runsResult.data as Array<Record<string, unknown>> | null) ?? [])
      .flatMap((run): IvoActivityItem[] => {
        const metadata = run.metadata && typeof run.metadata === "object" && !Array.isArray(run.metadata)
          ? run.metadata as Record<string, unknown>
          : {};
        const reads = Array.isArray(metadata.reads) ? metadata.reads : [];
        return reads.slice(0, 8).flatMap((raw, index) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
          const read = raw as Record<string, unknown>;
          const tool = typeof read.tool === "string" ? read.tool : "";
          if (!READ_LABELS[tool]) return [];
          const readStatus = read.status === "empty" || read.status === "unavailable"
            ? read.status
            : "succeeded";
          return [{
            id: `read:${String(run.id)}:${index}`,
            kind: "read" as const,
            status: readStatus,
            title: READ_LABELS[tool],
            detail: typeof read.scope === "string" ? read.scope.slice(0, 160) : null,
            occurredAt: String(run.created_at),
            href: null,
            requiredApproval: false,
            approvalState: "not_required" as const,
          }];
        });
      });

    const automationItems = (
      (automationRunsResult.data as unknown as AutomationRunRow[] | null) ?? []
    ).map(automationActivity);

    const items = [...actionItems, ...readItems, ...automationItems]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, parsed.data.limit);
    return { ok: true, data: { items, asOf: new Date().toISOString() } };
  } catch (error) {
    log.warn("ivo.activity.read_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Ivo couldn't read activity just now." };
  }
}
