import type { AutomationSuggestionRecord } from "@/features/automation/server";
import type { IvoPreparedAction } from "./prepared-actions";
import type { AssistantSuggestion } from "./suggestions";

const PREPARED_TRIGGER: Partial<Record<IvoPreparedAction["kind"], string>> = {
  payment_reminder: "invoice_overdue_followup",
  due_soon_reminder: "invoice_due_soon_review",
  proposal_followup: "proposal_followup",
  contract_followup: "contract_expiry_followup",
};

function taskKey(triggerKey: string, entityId: string | null): string {
  return `${triggerKey}:${entityId ?? "workspace"}`;
}

export function removeCoveredAutomation(
  suggestions: AutomationSuggestionRecord[],
  preparedActions: IvoPreparedAction[],
): AutomationSuggestionRecord[] {
  const preparedKeys = new Set(
    preparedActions.flatMap((action) => {
      const trigger = PREPARED_TRIGGER[action.kind];
      return trigger ? [taskKey(trigger, action.entityId)] : [];
    }),
  );
  return suggestions.filter(
    (suggestion) => !preparedKeys.has(taskKey(suggestion.triggerKey, suggestion.entityId)),
  );
}

export function removeCoveredInsights(
  insights: AssistantSuggestion[],
  preparedActions: IvoPreparedAction[],
  automations: AutomationSuggestionRecord[],
): AssistantSuggestion[] {
  const triggerKeys = new Set(automations.map((item) => item.triggerKey));
  const hasPaymentDraft = preparedActions.some(
    (item) => item.kind === "payment_reminder" || item.kind === "due_soon_reminder",
  );
  const hasInvoiceAutomation =
    triggerKeys.has("invoice_overdue_followup") || triggerKeys.has("invoice_due_soon_review");
  const hasUnbilledAutomation = triggerKeys.has("unbilled_time_invoice");

  return insights.filter((insight) => {
    if (insight.id === "overdue" && (hasPaymentDraft || hasInvoiceAutomation)) return false;
    if (insight.id === "unbilled" && hasUnbilledAutomation) return false;
    return true;
  });
}
