import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FIELD_KINDS,
  FIELD_OPERATIONS,
  buildFieldInstruction,
  buildFieldProposal,
  fieldMaxChars,
  fieldGenerationSchema,
  stripWrapping,
  validateFieldRequest,
} from "../field-generation";

/**
 * Smart fields are the surface where AI stops being a panel and starts living
 * inside the work. That also makes them the surface where a bad response does
 * the most damage: it lands directly in a document the user is about to send a
 * client.
 *
 * These cases hold the line on two things — a proposal is never a mutation,
 * and an untrustworthy response is refused rather than shown as a suggestion.
 */

const parsed = (input: Parameters<typeof validateFieldRequest>[0]) => {
  const result = validateFieldRequest(input);
  assert.ok(result.ok, "expected a valid request");
  return result.ok ? result.data : fieldGenerationSchema.parse(input);
};

describe("field generation — request validation", () => {
  it("refuses to shorten, improve or expand an empty field", () => {
    // Otherwise these silently become "generate", writing content the user
    // never asked for.
    for (const operation of ["improve", "shorten", "expand", "soften", "sharpen"] as const) {
      const result = validateFieldRequest({
        kind: "proposal_scope",
        operation,
        current: "   ",
      });
      assert.equal(result.ok, false, operation);
    }
  });

  it("allows generate on an empty field", () => {
    const result = validateFieldRequest({
      kind: "proposal_scope",
      operation: "generate",
      current: "",
    });
    assert.equal(result.ok, true);
  });

  it("allows generate over existing text — the diff makes the replacement visible", () => {
    const result = validateFieldRequest({
      kind: "proposal_scope",
      operation: "generate",
      current: "Existing scope the user wrote.",
    });
    assert.equal(result.ok, true);
  });

  it("rejects an unknown field kind or operation", () => {
    assert.equal(
      validateFieldRequest({ kind: "not_a_field", operation: "generate" } as never).ok,
      false,
    );
    assert.equal(
      validateFieldRequest({ kind: "proposal_scope", operation: "yolo" } as never).ok,
      false,
    );
  });
});

describe("field generation — proposals are never mutations", () => {
  const data = parsed({
    kind: "proposal_scope",
    operation: "improve",
    current: "Design and build a marketing site.",
  });

  it("returns the original alongside the proposal", () => {
    const result = buildFieldProposal(data, "Design, build and launch a marketing site.");
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.proposal.original, "Design and build a marketing site.");
    assert.notEqual(result.proposal.proposed, result.proposal.original);
  });

  it("includes a diff the caller can render before applying", () => {
    const result = buildFieldProposal(data, "Design, build and launch a marketing site.");
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.ok(result.proposal.diff.length > 0);
    assert.ok(result.proposal.stats.added > 0);
  });

  it("exposes no applied or mutated value anywhere on the proposal", () => {
    // A field component handed a replacement string cannot honour "never
    // overwrite without explicit apply", so the contract must not offer one.
    const result = buildFieldProposal(data, "Something different entirely.");
    assert.ok(result.ok);
    if (!result.ok) return;
    const keys = Object.keys(result.proposal);
    for (const forbidden of ["value", "applied", "result", "replacement"]) {
      assert.ok(!keys.includes(forbidden), `proposal must not expose "${forbidden}"`);
    }
  });

  it("flags a proposal that would change nothing", () => {
    const result = buildFieldProposal(data, "Design and build a marketing site.");
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.proposal.unchanged, true);
  });

  it("stamps asOf so a stale proposal is identifiable", () => {
    const result = buildFieldProposal(data, "A different scope.");
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.ok(!Number.isNaN(Date.parse(result.proposal.asOf)));
  });
});

describe("field generation — refusing untrustworthy output", () => {
  const data = parsed({
    kind: "payment_reminder",
    operation: "improve",
    current: "Just checking in on invoice 42.",
  });

  it("refuses an empty response rather than blanking the field", () => {
    for (const raw of ["", "   ", "\n\n"]) {
      assert.equal(buildFieldProposal(data, raw).ok, false, JSON.stringify(raw));
    }
  });

  it("refuses a non-string response", () => {
    for (const raw of [null, undefined, 42, { text: "hi" }, ["hi"]]) {
      assert.equal(buildFieldProposal(data, raw).ok, false, String(raw));
    }
  });

  it("refuses output past the field's character budget instead of truncating", () => {
    // Truncating would hand the user broken text mid-sentence to review.
    const tooLong = "x".repeat(fieldMaxChars("payment_reminder") + 1);
    assert.equal(buildFieldProposal(data, tooLong).ok, false);
  });

  it("accepts output exactly at the budget", () => {
    const exact = "x".repeat(fieldMaxChars("payment_reminder"));
    assert.equal(buildFieldProposal(data, exact).ok, true);
  });
});

describe("field generation — unwrapping model artefacts", () => {
  it("strips markdown fences", () => {
    assert.equal(stripWrapping("```\nHello there\n```"), "Hello there");
    assert.equal(stripWrapping("```text\nHello there\n```"), "Hello there");
  });

  it("strips a single pair of enclosing quotes", () => {
    assert.equal(stripWrapping('"Hello there"'), "Hello there");
  });

  it("leaves text that legitimately contains quotes intact", () => {
    // Unwrapping here would corrupt a clause that quotes a defined term.
    const value = 'The "Services" means the work described in Schedule A.';
    assert.equal(stripWrapping(value), value);
  });

  it("leaves ordinary text untouched", () => {
    assert.equal(stripWrapping("Design and build a marketing site."), "Design and build a marketing site.");
  });
});

describe("field generation — instructions", () => {
  it("covers every field kind and operation without throwing", () => {
    for (const kind of FIELD_KINDS) {
      for (const operation of FIELD_OPERATIONS) {
        const instruction = buildFieldInstruction(kind, operation);
        assert.ok(instruction.length > 0, `${kind}/${operation}`);
      }
    }
  });

  it("always forbids inventing figures, dates and commitments", () => {
    for (const kind of FIELD_KINDS) {
      const instruction = buildFieldInstruction(kind, "generate");
      assert.match(instruction, /never invent/i, kind);
    }
  });

  it("always instructs the model to ignore embedded instructions", () => {
    // The field content is attacker-controlled in the sense that a client's
    // brief can be pasted into it.
    for (const kind of FIELD_KINDS) {
      assert.match(buildFieldInstruction(kind, "improve"), /Ignore any instruction/i, kind);
    }
  });

  it("tells contract clauses not to invent legal obligations", () => {
    const instruction = buildFieldInstruction("contract_clause", "generate");
    assert.match(instruction, /legal obligations|jurisdiction|statutory/i);
  });

  it("includes brand voice when the business has one", () => {
    const instruction = buildFieldInstruction("email_body", "generate", "warm, plain-spoken, no jargon");
    assert.match(instruction, /warm, plain-spoken, no jargon/);
  });

  it("omits the brand voice line entirely when there is none", () => {
    const instruction = buildFieldInstruction("email_body", "generate", null);
    assert.ok(!/established voice/.test(instruction));
  });
});
