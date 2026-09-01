import "server-only";

import { getServerSupabase } from "@/lib/supabase/server";
import { getUnbilledTime } from "@/features/time/server";
import type { AutomationRecipeRecord, AutomationSuggestionRecord } from "./refresh-core";
import { ensureUserRecipes, refreshForUser } from "./refresh-core";

export type { AutomationRecipeRecord, AutomationSuggestionRecord, AutomationTone } from "./refresh-core";

async function requireUserId() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Session-scoped refresh: evaluates the signed-in user's moments and persists
 * them, returning the ready suggestions. RLS scopes the reads/writes.
 */
export async function refreshAutomationRuns(): Promise<{
  suggestions: AutomationSuggestionRecord[];
}> {
  const userId = await requireUserId();
  if (!userId) return { suggestions: [] };

  const supabase = await getServerSupabase();
  const { suggestions } = await refreshForUser(supabase, userId, () =>
    getUnbilledTime().then((summary) => ({
      totalAmount: summary.totalAmount,
      totalSeconds: summary.totalSeconds,
    })),
  );
  return { suggestions };
}

export async function getAutomationLiteSnapshot(): Promise<{
  recipes: AutomationRecipeRecord[];
  suggestions: AutomationSuggestionRecord[];
}> {
  const userId = await requireUserId();
  if (!userId) return { recipes: [], suggestions: [] };

  const supabase = await getServerSupabase();
  const result = await refreshForUser(supabase, userId, () =>
    getUnbilledTime().then((summary) => ({
      totalAmount: summary.totalAmount,
      totalSeconds: summary.totalSeconds,
    })),
  );
  return { recipes: result.recipes, suggestions: result.suggestions };
}

/**
 * Return the signed-in user's recipe controls without running the evaluator.
 * Settings should be a cheap read and must not create suggestions as a side
 * effect merely because the user opened the page.
 */
export async function getAutomationRecipes(): Promise<AutomationRecipeRecord[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const supabase = await getServerSupabase();
  return ensureUserRecipes(supabase, userId);
}

/**
 * Toggle a recipe's enabled state. Disabling prevents future evaluations of
 * that trigger (the evaluator reads `enabled` to build its trigger map). The
 * recipe must be owned by the signed-in user.
 */
export async function setRecipeEnabled(input: {
  recipeId: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("automation_recipes")
    .update({ enabled: input.enabled } as never)
    .eq("id", input.recipeId)
    .eq("user_id", userId)
    .select("id");
  if (error || !data || (data as unknown[]).length === 0) {
    return { ok: false, error: "Couldn't update that recipe." };
  }
  return { ok: true };
}

async function ownedSuggestion(suggestionId: string) {
  const userId = await requireUserId();
  if (!userId) return null;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("automation_suggestions")
    .select("id, recipe_id, trigger_key, metadata, status")
    .eq("id", suggestionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? { supabase, userId, suggestion: data as {
    id: string;
    recipe_id: string | null;
    trigger_key: string;
    metadata: unknown;
    status: string;
  } } : null;
}

export async function snoozeAutomationSuggestion(input: {
  suggestionId: string;
  until: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedSuggestion(input.suggestionId);
  if (!owned) return { ok: false, error: "This automation moment is no longer available." };
  const { data, error } = await owned.supabase
    .from("automation_suggestions")
    .update({ expires_at: input.until, acted_at: new Date().toISOString() } as never)
    .eq("id", input.suggestionId)
    .eq("user_id", owned.userId)
    .eq("status", "pending")
    .select("id");
  if (error || !data || (data as unknown[]).length === 0) {
    return { ok: false, error: "This automation moment was already handled." };
  }
  return { ok: true };
}

export async function dismissAutomationSuggestion(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedSuggestion(input.suggestionId);
  if (!owned) return { ok: false, error: "This automation moment is no longer available." };
  const dedupeKey =
    owned.suggestion.metadata && typeof owned.suggestion.metadata === "object"
      ? String((owned.suggestion.metadata as { dedupeKey?: unknown }).dedupeKey ?? "")
      : "";
  const { data, error } = await owned.supabase
    .from("automation_suggestions")
    .update({ status: "dismissed", acted_at: new Date().toISOString() } as never)
    .eq("id", input.suggestionId)
    .eq("user_id", owned.userId)
    .eq("status", "pending")
    .select("id");
  if (error || !data || (data as unknown[]).length === 0) {
    return { ok: false, error: "This automation moment was already handled." };
  }
  if (dedupeKey) {
    await owned.supabase
      .from("automation_runs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() } as never)
      .eq("user_id", owned.userId)
      .eq("dedupe_key", dedupeKey)
      .eq("status", "queued");
  }
  return { ok: true };
}

export async function disableAutomationSuggestionRecipe(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const owned = await ownedSuggestion(input.suggestionId);
  if (!owned || !owned.suggestion.recipe_id) {
    return { ok: false, error: "This automation recipe is no longer available." };
  }
  const now = new Date().toISOString();
  const { data, error } = await owned.supabase
    .from("automation_recipes")
    .update({ enabled: false } as never)
    .eq("id", owned.suggestion.recipe_id)
    .eq("user_id", owned.userId)
    .select("id");
  if (error || !data || (data as unknown[]).length === 0) {
    return { ok: false, error: "Couldn't disable that automation recipe." };
  }
  await Promise.all([
    owned.supabase
      .from("automation_suggestions")
      .update({ status: "dismissed", acted_at: now } as never)
      .eq("user_id", owned.userId)
      .eq("recipe_id", owned.suggestion.recipe_id)
      .eq("status", "pending"),
    owned.supabase
      .from("automation_runs")
      .update({ status: "cancelled", finished_at: now } as never)
      .eq("user_id", owned.userId)
      .eq("recipe_id", owned.suggestion.recipe_id)
      .eq("status", "queued"),
  ]);
  return { ok: true };
}
