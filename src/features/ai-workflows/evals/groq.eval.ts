import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGroqJson } from "../groq";

describe("Groq response handling", () => {
  it("parses a plain JSON response", () => {
    assert.deepEqual(parseGroqJson('{"intent":"invoice"}'), { intent: "invoice" });
  });

  it("removes reasoning traces and markdown fences", () => {
    assert.deepEqual(
      parseGroqJson('<think>private reasoning</think>\n```json\n{"ok":true}\n```'),
      { ok: true },
    );
  });

  it("extracts only the first balanced JSON value from surrounding prose", () => {
    assert.deepEqual(
      parseGroqJson('Result: {"text":"keep } and [ inside strings","items":[1,2]} Notes: {"ignored":true}'),
      { text: "keep } and [ inside strings", items: [1, 2] },
    );
  });

  it("rejects incomplete or mismatched JSON", () => {
    assert.equal(parseGroqJson('Result: {"ok": true'), null);
    assert.equal(parseGroqJson('Result: {"ok": true]'), null);
  });
});
