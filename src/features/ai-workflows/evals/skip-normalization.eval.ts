import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeSkipFieldValues } from "../runtime-planner";
import { AI_SKIP_SENTINEL } from "../types";

/**
 * The agent-path field merge must turn literal skip words into the sentinel.
 * The model is told to take field answers literally, so "skip" arrives as a
 * value; left unnormalised it poisons collected state and loops the workflow
 * on a field the user already skipped (IVO-005 investigation, client flow).
 */
describe("skip-word field normalization", () => {
  it("converts exact skip words to the sentinel", () => {
    const out = normalizeSkipFieldValues({
      phone: "skip",
      notes: "Skip",
      address: "N/A",
      other: "nah",
    });
    assert.equal(out.phone, AI_SKIP_SENTINEL);
    assert.equal(out.notes, AI_SKIP_SENTINEL);
    assert.equal(out.address, AI_SKIP_SENTINEL);
    assert.equal(out.other, AI_SKIP_SENTINEL);
  });

  it("never touches real values, even when they contain a skip word", () => {
    const out = normalizeSkipFieldValues({
      fullName: "Skip Marley",
      scope: "Skip the intro section and build the rest",
      amount: "50000",
      state: "Delhi",
    });
    assert.equal(out.fullName, "Skip Marley");
    assert.equal(out.scope, "Skip the intro section and build the rest");
    assert.equal(out.amount, "50000");
    assert.equal(out.state, "Delhi");
  });

  it("leaves the sentinel itself untouched", () => {
    const out = normalizeSkipFieldValues({ phone: AI_SKIP_SENTINEL });
    assert.equal(out.phone, AI_SKIP_SENTINEL);
  });

  it("returns an empty map unchanged", () => {
    assert.deepEqual(normalizeSkipFieldValues({}), {});
  });
});
