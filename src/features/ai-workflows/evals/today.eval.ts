import assert from "node:assert/strict";
import test from "node:test";

import { removeCoveredAutomation, removeCoveredInsights } from "../today-core";
import type { IvoPreparedAction } from "../prepared-actions";
import type { AutomationSuggestionRecord } from "../../automation/server";

function prepared(
  kind: IvoPreparedAction["kind"],
  entityId: string,
): IvoPreparedAction {
  return {
    id: `prepared-${entityId}`,
    kind,
    entityType: "invoice",
    entityId,
    title: "Prepared",
    description: "Exact draft",
    subject: "Subject",
    body: "Body",
    recipientName: "Client",
    recipientEmail: "client@example.com",
    href: "/dashboard",
    tone: "info",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
}

function automation(
  triggerKey: string,
  entityId: string | null,
): AutomationSuggestionRecord {
  return {
    id: `${triggerKey}-${entityId}`,
    recipeId: "70000000-0000-4000-8000-000000000001",
    triggerKey,
    entityType: entityId ? "invoice" : null,
    entityId,
    title: "Moment",
    description: "Reason",
    prompt: "Review this",
    href: "/dashboard",
    tone: "info",
  };
}

test("an exact prepared draft hides only the matching entity automation", () => {
  const suggestions = [
    automation("invoice_overdue_followup", "invoice-a"),
    automation("invoice_overdue_followup", "invoice-b"),
  ];
  const result = removeCoveredAutomation(
    suggestions,
    [prepared("payment_reminder", "invoice-a")],
  );

  assert.deepEqual(result.map((item) => item.entityId), ["invoice-b"]);
});

test("durable moments suppress duplicate cash-flow insights but retain analysis", () => {
  const insights = [
    { id: "overdue", title: "Overdue", prompt: "Plan", tone: "alert" as const },
    { id: "unbilled", title: "Unbilled", prompt: "Invoice", tone: "info" as const },
    { id: "concentration", title: "Concentration", prompt: "Analyse", tone: "info" as const },
  ];
  const result = removeCoveredInsights(
    insights,
    [],
    [
      automation("invoice_overdue_followup", "invoice-a"),
      automation("unbilled_time_invoice", null),
    ],
  );

  assert.deepEqual(result.map((item) => item.id), ["concentration"]);
});
