import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextIvoMissingField, planIvoWorkflowNextAction } from "../workflow-progress";
import { AI_SKIP_SENTINEL, NO_CLIENT_SENTINEL, NO_PROJECT_SENTINEL } from "../types";
import type { AiFields, AiWorkflow } from "../types";

/**
 * Field sequencing decides which question Ivo asks next, and when it stops
 * asking and invokes the create tool.
 *
 * Two failure modes matter here. Asking for a field the user already answered
 * makes the assistant look broken and, if the sequence never advances, loops
 * forever. Failing to ask for a required field lets a create tool run on
 * incomplete input — the tools re-check independently as a safety boundary, but
 * by then the user has been told their invoice is being drafted.
 *
 * All pure: no model call, no database.
 */

const REQUEST_ID = "00000000-0000-4000-8000-000000000000";

function missing(
  workflow: AiWorkflow,
  fields: AiFields,
  context: { clientId?: string; projectId?: string; currency?: string } = {},
) {
  return nextIvoMissingField({
    workflow,
    fields,
    clientId: context.clientId ?? "",
    projectId: context.projectId ?? "",
    currency: context.currency,
  });
}

/** Drives the sequence to completion, guarding against a non-advancing loop. */
function askOrder(
  workflow: AiWorkflow,
  context: { clientId?: string; projectId?: string; currency?: string } = {},
  answers: Record<string, string> = {},
): string[] {
  const fields: AiFields = {};
  const asked: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const next = missing(workflow, fields, context);
    if (!next) return asked;
    asked.push(next.field);
    if (asked.filter((f) => f === next.field).length > 1) {
      throw new Error(`sequence looped on "${next.field}" for ${workflow}: ${asked.join(" -> ")}`);
    }
    // Answer with the supplied value, or skip when the field allows it.
    fields[next.field] = answers[next.field] ?? (next.optional ? AI_SKIP_SENTINEL : "provided");
  }
  throw new Error(`sequence did not terminate for ${workflow}: ${asked.join(" -> ")}`);
}

const WORKFLOWS: AiWorkflow[] = [
  "invoice",
  "contract",
  "proposal",
  "welcome_document",
  "client",
  "project",
  "time_entry",
  "meeting",
];

describe("field sequencing — termination", () => {
  for (const workflow of WORKFLOWS) {
    it(`${workflow} reaches a complete state without repeating a question`, () => {
      // A client and project are supplied so entity pickers do not stall the
      // walk; amount needs a real number because 0 is treated as unanswered.
      assert.doesNotThrow(() =>
        askOrder(workflow, { clientId: "c-1", projectId: "p-1" }, { amount: "50000" }),
      );
    });
  }

  it("never re-asks a field the user explicitly skipped", () => {
    const asked = askOrder("invoice", { clientId: "c-1", projectId: "p-1" }, { amount: "50000" });
    assert.equal(new Set(asked).size, asked.length);
  });
});

describe("field sequencing — entity prerequisites", () => {
  it("asks for the client first when none is set", () => {
    const next = missing("invoice", {});
    assert.equal(next?.field, "clientId");
  });

  it("accepts the deliberate no-client choice instead of asking again", () => {
    const next = missing("invoice", {}, { clientId: NO_CLIENT_SENTINEL });
    assert.notEqual(next?.field, "clientId");
  });

  it("accepts the deliberate no-project choice instead of asking again", () => {
    const next = missing("invoice", {}, { clientId: "c-1", projectId: NO_PROJECT_SENTINEL });
    assert.notEqual(next?.field, "projectId");
  });

  it("requires a project for a time entry even after the sequence is satisfied", () => {
    // Time is logged against a project; without one the entry cannot be billed.
    // `duration` is the last sequenced field, so this asserts the extra check
    // that runs after the sequence completes.
    const next = missing(
      "time_entry",
      { description: "Wireframes", duration: "2h" },
      { clientId: "c-1" },
    );
    assert.equal(next?.field, "projectId");
  });
});

describe("field sequencing — invoice amount", () => {
  // `workDescription` precedes `amount` in the invoice sequence, so it has to
  // be answered before the amount question is reachable.
  const upToAmount = (amount?: string): AiFields =>
    amount === undefined
      ? { workDescription: "Website redesign" }
      : { workDescription: "Website redesign", amount };

  it("treats a zero or unparseable amount as unanswered", () => {
    for (const amount of ["", "0", "nothing", "abc"]) {
      const next = missing("invoice", upToAmount(amount), { clientId: "c-1", projectId: "p-1" });
      assert.equal(next?.field, "amount", `"${amount}" should still be missing`);
    }
  });

  it("accepts Indian shorthand amounts", () => {
    for (const amount of ["50k", "2.5 lakh", "1 crore", "50,000"]) {
      const next = missing("invoice", upToAmount(amount), { clientId: "c-1", projectId: "p-1" });
      assert.notEqual(next?.field, "amount", `"${amount}" should satisfy amount`);
    }
  });

  it("asks in INR with a GST note for a domestic client", () => {
    const next = missing("invoice", upToAmount(), {
      clientId: "c-1",
      projectId: "p-1",
      currency: "INR",
    });
    assert.equal(next?.field, "amount");
    assert.match(next?.question ?? "", /INR/);
    assert.match(next?.tip ?? "", /GST/i);
  });

  it("asks in the client's own currency and says export invoices are zero-rated", () => {
    const next = missing("invoice", upToAmount(), {
      clientId: "c-1",
      projectId: "p-1",
      currency: "USD",
    });
    assert.equal(next?.field, "amount");
    assert.match(next?.question ?? "", /USD/);
    // Charging GST on an export would be a real filing error.
    assert.match(next?.tip ?? "", /zero-rated|no GST/i);
  });
});

describe("field sequencing — welcome document branching", () => {
  it("asks for a template before any custom content", () => {
    const next = missing("welcome_document", {}, { clientId: "c-1", projectId: "p-1" });
    assert.equal(next?.field, "welcomeTemplate");
  });

  it("stops asking once a ready-made template is chosen", () => {
    const next = missing(
      "welcome_document",
      { welcomeTemplate: "onboarding-basic" },
      { clientId: "c-1", projectId: "p-1" },
    );
    assert.equal(next, null);
  });

  it("keeps collecting when the user chose to describe their own", () => {
    const next = missing(
      "welcome_document",
      { welcomeTemplate: "__custom__" },
      { clientId: "c-1", projectId: "p-1" },
    );
    assert.notEqual(next, null);
  });
});

describe("next action — tool invocation", () => {
  it("asks a field while anything required is outstanding", () => {
    const action = planIvoWorkflowNextAction({
      workflow: "invoice",
      fields: {},
      clientId: "",
      projectId: "",
      requestId: REQUEST_ID,
    });
    assert.equal(action.kind, "ask_field");
  });

  it("routes general and support conversations away from any create tool", () => {
    for (const workflow of ["general", "support"] as const) {
      const action = planIvoWorkflowNextAction({
        workflow,
        fields: {},
        clientId: "",
        projectId: "",
        requestId: REQUEST_ID,
      });
      assert.equal(action.kind, "answer_support", workflow);
    }
  });

  it("carries the caller's request id into the tool call as its idempotency key", () => {
    const action = planIvoWorkflowNextAction({
      workflow: "welcome_document",
      fields: { welcomeTemplate: "onboarding-basic" },
      clientId: "c-1",
      projectId: "p-1",
      requestId: REQUEST_ID,
    });
    assert.equal(action.kind, "invoke_tool");
    if (action.kind !== "invoke_tool") return;
    // A tool invoked without the caller's id would lose its retry barrier.
    assert.equal(action.requestId, REQUEST_ID);
  });

  it("names a tool that matches the workflow it came from", () => {
    const action = planIvoWorkflowNextAction({
      workflow: "welcome_document",
      fields: { welcomeTemplate: "onboarding-basic" },
      clientId: "c-1",
      projectId: "p-1",
      requestId: REQUEST_ID,
    });
    if (action.kind !== "invoke_tool") return;
    assert.match(action.tool, /^welcome_document\./);
  });
});
