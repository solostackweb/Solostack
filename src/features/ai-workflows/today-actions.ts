"use server";

/**
 * One client boundary for Ivo's Today surface. The expensive reads run inside
 * one server action, and exact prepared drafts win over generic automation
 * moments for the same entity so users never see two versions of one task.
 */
import { getAutomationLiteSnapshot } from "@/features/automation/server";
import type { AutomationSuggestionRecord } from "@/features/automation/server";
import { refreshIvoPreparedActionsAction as refreshPreparedActions } from "./prepared-actions";
import type { IvoPreparedAction } from "./prepared-actions";
import { getAssistantSuggestions, type AssistantSuggestion } from "./suggestions";
import { removeCoveredAutomation, removeCoveredInsights } from "./today-core";

export async function getIvoTodayAction(): Promise<{
  ok: true;
  data: {
    preparedActions: IvoPreparedAction[];
    automationSuggestions: AutomationSuggestionRecord[];
    insights: AssistantSuggestion[];
  };
}> {
  const [preparedResult, automationResult, insightResult] = await Promise.allSettled([
    refreshPreparedActions(),
    getAutomationLiteSnapshot(),
    getAssistantSuggestions(),
  ]);

  const preparedActions =
    preparedResult.status === "fulfilled" && preparedResult.value.ok
      ? preparedResult.value.data
      : [];
  const rawAutomations =
    automationResult.status === "fulfilled" ? automationResult.value.suggestions : [];
  const automationSuggestions = removeCoveredAutomation(rawAutomations, preparedActions);
  const rawInsights = insightResult.status === "fulfilled" ? insightResult.value : [];

  return {
    ok: true,
    data: {
      preparedActions,
      automationSuggestions,
      insights: removeCoveredInsights(rawInsights, preparedActions, automationSuggestions),
    },
  };
}
