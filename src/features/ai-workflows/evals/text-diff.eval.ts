import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyDiff, diffStats, diffWords, isNoOpDiff } from "../text-diff";

/**
 * The diff is what makes "generated content never overwrites your work without
 * an explicit apply" a checkable property rather than a claim.
 *
 * The single most important case is round-tripping: applying a diff must
 * reproduce the proposed text exactly. If it does not, the user reviews one
 * thing and their document receives another — a silent corruption in the one
 * place they were told they were in control.
 */

describe("text diff — round trip", () => {
  const pairs: Array<[original: string, proposed: string]> = [
    ["", ""],
    ["", "Some entirely new scope of work."],
    ["Existing text that goes away.", ""],
    ["The quick brown fox", "The quick red fox"],
    ["Design and build a marketing site.", "Design, build and launch a marketing site."],
    ["one two three four five", "five four three two one"],
    ["Payment due in 30 days.", "Payment due within 15 days of invoice date."],
    ["Same text", "Same text"],
    ["a\nb\nc", "a\nB\nc"],
    ["  leading and trailing  ", "  leading and trailing changed  "],
    ["₹50,000 for the first milestone", "₹75,000 for the first milestone"],
  ];

  for (const [original, proposed] of pairs) {
    it(`applying reproduces the proposal exactly: "${original.slice(0, 28)}…"`, () => {
      assert.equal(applyDiff(diffWords(original, proposed)), proposed);
    });
  }

  it("round-trips a long realistic clause", () => {
    const original = Array.from({ length: 120 }, (_, i) => `clause term ${i}`).join(". ");
    const proposed = original.replace("term 40", "term forty").replace("term 90", "term ninety");
    assert.equal(applyDiff(diffWords(original, proposed)), proposed);
  });

  it("still round-trips past the alignment limit", () => {
    // Beyond MAX_TOKENS the diff degrades to a wholesale replacement, but it
    // must remain correct — a user applying it still gets what they reviewed.
    const original = Array.from({ length: 1500 }, (_, i) => `word${i}`).join(" ");
    const proposed = `${original} and one more`;
    assert.equal(applyDiff(diffWords(original, proposed)), proposed);
  });
});

describe("text diff — change detection", () => {
  it("reports no change when the text is identical", () => {
    assert.equal(isNoOpDiff(diffWords("Same text here", "Same text here")), true);
  });

  it("reports a change when a single word differs", () => {
    assert.equal(isNoOpDiff(diffWords("Payment due in 30 days", "Payment due in 15 days")), false);
  });

  it("treats an empty proposal against empty original as no change", () => {
    assert.equal(isNoOpDiff(diffWords("", "")), true);
  });

  it("marks only the words that actually changed", () => {
    const segments = diffWords("The quick brown fox", "The quick red fox");
    const unchanged = segments
      .filter((s) => s.op === "unchanged")
      .map((s) => s.text)
      .join("");
    // "The quick " and " fox" survive; only the colour word is touched.
    assert.match(unchanged, /The quick/);
    assert.match(unchanged, /fox/);
  });
});

describe("text diff — stats", () => {
  it("counts added and removed words", () => {
    const stats = diffStats(diffWords("one two three", "one two three four five"));
    assert.equal(stats.added, 2);
    assert.equal(stats.removed, 0);
  });

  it("counts a pure deletion", () => {
    const stats = diffStats(diffWords("one two three four", "one two"));
    assert.equal(stats.added, 0);
    assert.equal(stats.removed, 2);
  });

  it("reports zero on an unchanged field", () => {
    const stats = diffStats(diffWords("unchanged text", "unchanged text"));
    assert.deepEqual(stats, { added: 0, removed: 0 });
  });
});
