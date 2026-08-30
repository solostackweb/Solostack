import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listDecision } from "../runtime-planner";

/**
 * The deterministic list lane in conversation-actions.ts routes pure list
 * requests before any model call, reusing this exact function. These cases pin
 * the boundary: a phrase that lands here skips Groq entirely, so a false
 * positive would silently replace the agent for a non-list request.
 */
describe("deterministic list lane", () => {
  it("recognises pure list requests per entity and filter", () => {
    assert.deepEqual(listDecision("show my invoices"), {
      kind: "list",
      entityType: "invoice",
      filter: "unpaid",
    });
    assert.deepEqual(listDecision("show overdue invoices"), {
      kind: "list",
      entityType: "invoice",
      filter: "overdue",
    });
    assert.deepEqual(listDecision("list all contracts"), {
      kind: "list",
      entityType: "contract",
      filter: "all",
    });
    assert.deepEqual(listDecision("show pending proposals"), {
      kind: "list",
      entityType: "proposal",
      filter: "pending",
    });
    assert.deepEqual(listDecision("show my clients"), {
      kind: "list",
      entityType: "client",
      filter: "all",
    });
    assert.deepEqual(listDecision("show active projects"), {
      kind: "list",
      entityType: "project",
      filter: "active",
    });
  });

  it("never hijacks creation requests", () => {
    assert.equal(listDecision("create an invoice for 50000"), null);
    assert.equal(listDecision("draft a new contract for Priya"), null);
    assert.equal(listDecision("make a proposal"), null);
    assert.equal(listDecision("add a client called Rao Traders"), null);
  });

  it("never hijacks business questions or analysis requests", () => {
    assert.equal(listDecision("how much revenue this month?"), null);
    assert.equal(listDecision("which clients owe me the most?"), null);
    assert.equal(
      listDecision("What unbilled time should I invoice?"),
      null,
    );
    assert.equal(listDecision("who needs a portal?"), null);
  });

  it("does not treat status changes or payment wording as list requests", () => {
    assert.equal(listDecision("mark invoice INV-12 as paid"), null);
    assert.equal(listDecision("send a reminder for the overdue invoice"), null);
  });

  it("stays quiet on ordinary conversation", () => {
    assert.equal(listDecision("hey what's up"), null);
    assert.equal(listDecision("thanks!"), null);
  });
});

