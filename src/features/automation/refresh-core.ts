import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { AutomationRecipeRow, AutomationSuggestionRow } from "@/lib/supabase/types";
import {
  evaluateAutomation,
  filterNewCandidates,
  type AutomationTriggerKey,
  type EvaluatorSnapshot,
} from "./evaluator-core";

export type AutomationTone = "info" | "warning" | "danger";

export interface AutomationRecipeRecord {  id: string;
  triggerKey: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface AutomationSuggestionRecord {
  id: string;
  recipeId: string | null;
  triggerKey: string;
  entityType: string | null;
  entityId: string | null;
  title: string;
  description: string;
  prompt: string;
  href: string;
  tone: AutomationTone;
}

const DEFAULT_RECIPES = [
  {
    trigger_key: "invoice_overdue_followup",
    name: "Overdue invoice follow-up",
    description: "Suggest a reminder when an invoice crosses its due date.",
  },
  {
    trigger_key: "invoice_due_soon_review",
    name: "Due-soon invoice review",
    description: "Suggest a gentle pre-due reminder for invoices due soon.",
  },
  {
    trigger_key: "proposal_followup",
    name: "Proposal follow-up",
    description: "Suggest a follow-up when a sent proposal has gone quiet.",
  },
  {
    trigger_key: "unbilled_time_invoice",
    name: "Unbilled time invoice",
    description: "Suggest invoicing billable time that has not been billed.",
  },
  {
    trigger_key: "contract_expiry_followup",
    name: "Contract expiry follow-up",
    description: "Suggest action before a sent contract expires.",
  },
] as const;

export function mapRecipeRow(row: AutomationRecipeRow): AutomationRecipeRecord {
  return {
    id: row.id,
    triggerKey: row.trigger_key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
  };
}

function mapSuggestionRow(row: AutomationSuggestionRow): AutomationSuggestionRecord {
  const metadata = (row.metadata ?? {}) as { href?: string; tone?: AutomationTone };
  return {
    id: row.id,
    recipeId: row.recipe_id,
    triggerKey: row.trigger_key,
    entityType: row.entity_type,
    entityId: row.entity_id,
    title: row.title,
    description: row.description ?? "",
    prompt: row.prompt,
    href: metadata.href ?? "/dashboard",
    tone: metadata.tone ?? "info",
  };
}

export async function ensureUserRecipes(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AutomationRecipeRecord[]> {
  const rows = DEFAULT_RECIPES.map((recipe) => ({
    ...recipe,
    user_id: userId,
    enabled: true,
  }));

  await supabase
    .from("automation_recipes")
    .upsert(rows as never, { onConflict: "user_id,trigger_key", ignoreDuplicates: true });

  const { data, error } = await supabase
    .from("automation_recipes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return DEFAULT_RECIPES.map((recipe, index) => ({
      id: `default-${index}`,
      triggerKey: recipe.trigger_key,
      name: recipe.name,
      description: recipe.description,
      enabled: true,
    } as never));
  }

  return (data as unknown as AutomationRecipeRow[]).map(mapRecipeRow);
}

/** Unbilled-time loader: returns { totalAmount, totalSeconds } or null. */
type UnbilledLoader = () => Promise<{ totalAmount: number; totalSeconds: number } | null>;

function toSnapshot(
  rows: {
    overdue: Array<Record<string, unknown>>;
    dueSoon: Array<Record<string, unknown>>;
    proposals: Array<Record<string, unknown>>;
    contracts: Array<Record<string, unknown>>;
    unbilled: { totalAmount: number; totalSeconds: number } | null;
  },
): EvaluatorSnapshot {
  return {
    overdueInvoices: rows.overdue.map((row) => ({
      id: String(row.id),
      invoice_number: String(row.invoice_number),
      total_amount: Number(row.total_amount),
      currency: String(row.currency),
      due_date: String(row.due_date),
    })),
    dueSoonInvoices: rows.dueSoon.map((row) => ({
      id: String(row.id),
      invoice_number: String(row.invoice_number),
      total_amount: Number(row.total_amount),
      currency: String(row.currency),
      due_date: String(row.due_date),
    })),
    staleProposals: rows.proposals.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      status: String(row.status),
      total_amount: Number(row.total_amount),
      currency: String(row.currency),
      updated_at: String(row.updated_at),
    })),
    expiringContracts: rows.contracts.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      expires_at: row.expires_at ? String(row.expires_at) : null,
    })),
    unbilled: rows.unbilled
      ? {
          totalAmount: rows.unbilled.totalAmount,
          totalHours: rows.unbilled.totalSeconds / 3600,
        }
      : null,
  };
}

/**
 * Read the rows the evaluator needs for one user. The caller's client decides
 * the security model: a session client relies on RLS, while the admin cron
 * client bypasses it — so rows are always filtered by `user_id` explicitly.
 */
async function readSnapshot(
  supabase: SupabaseClient<Database>,
  userId: string,
  unbilled: UnbilledLoader,
): Promise<EvaluatorSnapshot | null> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in3 = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000).toISOString();

  const [overdueRes, dueSoonRes, proposalRes, contractRes, unbilledRes] =
    await Promise.all([
      supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, currency, due_date")
        .eq("user_id", userId)
        .in("status", ["sent", "viewed", "overdue", "partially_paid"])
        .lte("due_date", today)
        .order("due_date", { ascending: true }),
      supabase
        .from("invoices")
        .select("id, invoice_number, total_amount, currency, due_date")
        .eq("user_id", userId)
        .in("status", ["sent", "viewed", "partially_paid"])
        .gte("due_date", today)
        .lte("due_date", in3)
        .order("due_date", { ascending: true }),
      supabase
        .from("proposals")
        .select("id, title, status, total_amount, currency, updated_at")
        .eq("user_id", userId)
        .in("status", ["sent", "viewed"])
        .lte("updated_at", threeDaysAgo)
        .order("updated_at", { ascending: true }),
      supabase
        .from("contracts")
        .select("id, title, expires_at")
        .eq("user_id", userId)
        .in("status", ["sent", "viewed"])
        .not("expires_at", "is", null)
        .gte("expires_at", now.toISOString())
        .lte("expires_at", in7)
        .order("expires_at", { ascending: true }),
      unbilled().catch(() => null),
    ]);

  return toSnapshot({
    overdue: (overdueRes.data as unknown as Array<Record<string, unknown>>) ?? [],
    dueSoon: (dueSoonRes.data as unknown as Array<Record<string, unknown>>) ?? [],
    proposals: (proposalRes.data as unknown as Array<Record<string, unknown>>) ?? [],
    contracts: (contractRes.data as unknown as Array<Record<string, unknown>>) ?? [],
    unbilled: unbilledRes,
  });
}

const MAX_PERSISTED = 4;

/**
 * Evaluate and persist one user's automation moments, idempotently, using the
 * given client. Requires the caller to be authorized for `userId` (session RLS
 * or admin/service-role).
 */
export async function refreshForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  unbilled: UnbilledLoader,
): Promise<{ suggestions: AutomationSuggestionRecord[]; recipes: AutomationRecipeRecord[] }> {
  const recipes = await ensureUserRecipes(supabase, userId);
  const snapshot = await readSnapshot(supabase, userId, unbilled);
  if (!snapshot) return { suggestions: [], recipes };

  const enabled = Object.fromEntries(
    recipes.map((recipe) => [recipe.triggerKey, recipe.enabled]),
  ) as Partial<Record<AutomationTriggerKey, boolean>>;
  const candidates = evaluateAutomation(snapshot, new Date(), enabled);

  const { data: pendingRaw } = await supabase
    .from("automation_suggestions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["pending", "approved", "dismissed"])
    .limit(60);
  const pending = (pendingRaw as unknown as AutomationSuggestionRow[] | null) ?? [];
  const pendingKeys = pending
    .map((row) => (row.metadata as { dedupeKey?: string })?.dedupeKey)
    .filter((k): k is string => !!k);
  const liveKeys = new Set(pendingKeys);

  // Expire stuck suggestions whose moment has passed (invoice paid, proposal
  // accepted…) so the queue never shows dead work.
  const currentKeys = new Set(candidates.map((candidate) => candidate.dedupeKey));
  const stale = pending.filter(
    (row) =>
      !currentKeys.has((row.metadata as { dedupeKey?: string })?.dedupeKey ?? ""),
  );
  if (stale.length > 0) {
    const staleKeys = stale
      .map((row) => (row.metadata as { dedupeKey?: string })?.dedupeKey)
      .filter((key): key is string => Boolean(key));
    await supabase
      .from("automation_suggestions")
      .update({ status: "expired" } as never)
      .in("id", stale.map((row) => row.id))
      .eq("user_id", userId);
    if (staleKeys.length > 0) {
      await supabase
        .from("automation_runs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() } as never)
        .eq("user_id", userId)
        .in("dedupe_key", staleKeys)
        .eq("status", "queued");
      // Release the partial unique key only after the moment has genuinely
      // cleared. This preserves the historical run while allowing the same
      // entity to produce a new run if the condition recurs later.
      await supabase
        .from("automation_runs")
        .update({ dedupe_key: null } as never)
        .eq("user_id", userId)
        .in("dedupe_key", staleKeys)
        .in("status", ["succeeded", "failed", "cancelled"]);
    }
  }

  const fresh = filterNewCandidates(candidates, liveKeys).slice(0, MAX_PERSISTED);
  const recipeByTrigger = new Map(recipes.map((recipe) => [recipe.triggerKey, recipe.id]));

  for (const candidate of fresh) {
    await supabase.from("automation_suggestions").insert({
      user_id: userId,
      recipe_id: recipeByTrigger.get(candidate.triggerKey) ?? null,
      trigger_key: candidate.triggerKey,
      entity_type: candidate.entityType,
      entity_id: candidate.entityId !== "workspace" ? candidate.entityId : null,
      title: candidate.title,
      description: candidate.description,
      prompt: candidate.prompt,
      status: "pending",
      metadata: { dedupeKey: candidate.dedupeKey, href: candidate.href, tone: candidate.tone },
    } as never);

    // Durable run ledger row for the same moment. We dedupe in code rather
    // than with a postgREST `upsert(..., onConflict)` because migration 0085
    // declares the uniqueness on a PARTIAL index (`where dedupe_key is not
    // null`), which postgREST cannot target — postgREST emits a plain
    // `ON CONFLICT (cols)` without the WHERE predicate, and Postgres rejects
    // it. Selecting then inserting mirrors how suggestions are already
    // deduped and keeps the partial index as the DB-level safety net.
    // 'queued' until an executor picks it up; inputs stay factual (no prompt
    // content in the ledger). Workspace-wide moments (unbilled time) carry no
    // entity id — the column is a uuid.
    const { data: existingRun } = await supabase
      .from("automation_runs")
      .select("id")
      .eq("user_id", userId)
      .eq("trigger_key", candidate.triggerKey)
      .eq("dedupe_key", candidate.dedupeKey);
    if (!existingRun || (existingRun as unknown[]).length === 0) {
      await supabase.from("automation_runs").insert({
        user_id: userId,
        recipe_id: recipeByTrigger.get(candidate.triggerKey) ?? null,
        trigger_key: candidate.triggerKey,
        dedupe_key: candidate.dedupeKey,
        status: "queued",
        entity_type: candidate.entityType,
        entity_id: candidate.entityId !== "workspace" ? candidate.entityId : null,
        reason: candidate.title,
      } as never);
    }
  }

  const { data: ready } = await supabase
    .from("automation_suggestions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .or(`expires_at.is.null,expires_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(MAX_PERSISTED);

  return {
    suggestions: ((ready as unknown as AutomationSuggestionRow[] | null) ?? []).map(mapSuggestionRow),
    recipes,
  };
}

/**
 * List user ids who have any enabled recipe, for the scheduled evaluator to
 * loop over. Caller must be authorized (admin client).
 */
export async function listAutomationUserIds(
  supabase: SupabaseClient<Database>,
): Promise<string[]> {
  const { data } = await supabase
    .from("automation_recipes")
    .select("user_id")
    .eq("enabled", true);
  const rows = (data as unknown as Array<{ user_id: string }> | null) ?? [];
  return Array.from(new Set(rows.map((row) => row.user_id)));
}
