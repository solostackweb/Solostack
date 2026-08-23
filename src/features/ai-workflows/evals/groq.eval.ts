import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseGroqJson,
  parseRetryAfterMs,
  shouldBailOnRateLimit,
} from "../groq";

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

describe("rate-limit bail decision", () => {
  it("bails only on 429 with a Retry-After wait above the interactive threshold", () => {
    assert.equal(shouldBailOnRateLimit(429, "5"), true);
    assert.equal(shouldBailOnRateLimit(429, "60"), true);
  });

  it("keeps the quick inline retry for short or missing waits", () => {
    assert.equal(shouldBailOnRateLimit(429, "1"), false);
    assert.equal(shouldBailOnRateLimit(429, null), false);
    assert.equal(shouldBailOnRateLimit(429, ""), false);
    assert.equal(shouldBailOnRateLimit(429, "not-a-date"), false);
  });

  it("never bails for other statuses, whatever the header says", () => {
    assert.equal(shouldBailOnRateLimit(500, "60"), false);
    assert.equal(shouldBailOnRateLimit(401, "60"), false);
    assert.equal(shouldBailOnRateLimit(200, "60"), false);
  });

  it("honours HTTP-date form retry headers", () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    assert.equal(shouldBailOnRateLimit(429, future), true);
  });

  it("parses delta-seconds and rejects garbage", () => {
    assert.equal(parseRetryAfterMs("2"), 2000);
    assert.equal(parseRetryAfterMs("0"), 0);
    assert.equal(parseRetryAfterMs(" 3 "), 3000);
    assert.equal(parseRetryAfterMs(null), null);
    assert.equal(parseRetryAfterMs(undefined), null);
    assert.equal(parseRetryAfterMs("soon-ish"), null);
  });
});
