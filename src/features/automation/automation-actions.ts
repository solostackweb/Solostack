"use server";

/**
 * Client-safe server-action facade for automation. Keeps the database and the
 * session-scoped execution implementation out of browser bundles; the cron
 * route imports the evaluator core directly on the server.
 */
import { z } from "zod";

import { executeAutomationRunAction as executeAutomationRun } from "./executor";
import {
  getAutomationRecipes,
  dismissAutomationSuggestion as dismissSuggestion,
  disableAutomationSuggestionRecipe as disableSuggestionRecipe,
  setRecipeEnabled as setRecipeEnabledImpl,
  snoozeAutomationSuggestion as snoozeSuggestion,
  type AutomationRecipeRecord,
} from "./server";

const suggestionInputSchema = z.object({ suggestionId: z.string().uuid() });
const recipeInputSchema = z.object({
  recipeId: z.string().uuid(),
  enabled: z.boolean(),
});
const snoozeInputSchema = suggestionInputSchema.extend({
  until: z.string().datetime(),
});

export type { AutomationRecipeRecord };

export async function executeAutomationRunAction(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = suggestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That automation request is invalid." };
  return executeAutomationRun(parsed.data);
}

export async function getAutomationRecipesAction(): Promise<
  { ok: true; data: AutomationRecipeRecord[] } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await getAutomationRecipes() };
  } catch {
    return { ok: false, error: "Couldn't load Ivo's automation controls." };
  }
}

export async function setRecipeEnabledAction(input: {
  recipeId: string;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That automation setting is invalid." };
  return setRecipeEnabledImpl(parsed.data);
}

export async function snoozeAutomationSuggestionAction(input: {
  suggestionId: string;
  until: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = snoozeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That snooze request is invalid." };
  const until = new Date(parsed.data.until).getTime();
  const now = Date.now();
  if (until <= now || until > now + 30 * 86_400_000) {
    return { ok: false, error: "Choose a snooze time within the next 30 days." };
  }
  return snoozeSuggestion(parsed.data);
}

export async function dismissAutomationSuggestionAction(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = suggestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That dismiss request is invalid." };
  return dismissSuggestion(parsed.data);
}

export async function disableAutomationSuggestionRecipeAction(input: {
  suggestionId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = suggestionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That recipe request is invalid." };
  return disableSuggestionRecipe(parsed.data);
}
