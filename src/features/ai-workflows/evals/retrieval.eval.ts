import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asRetrieval,
  retrievalUnavailable,
  retrievedRecords,
  retrievedValue,
} from "../retrieval";

/**
 * The retrieval envelope is the contract that keeps grounded answers honest.
 * Two failure modes are what these cases exist to prevent:
 *
 *   - A failed read presented to the model as an empty one, which becomes
 *     "you have no overdue invoices" — confident, wrong, and about money.
 *   - A truncated payload that no longer parses, leaving the model to invent
 *     whatever was cut off.
 */

const invoice = (i: number) => ({
  id: `inv-${i}`,
  client: "A fairly long client business name Pvt Ltd",
  amount: 12345.67,
  status: "overdue",
  dueDate: "2026-01-15",
});

describe("retrieval envelope — payload integrity", () => {
  it("keeps an oversized payload parseable", () => {
    const result = retrievedRecords("invoices", "filter=overdue", Array.from({ length: 400 }, (_, i) => invoice(i)));
    const encoded = JSON.stringify(result);
    assert.doesNotThrow(() => JSON.parse(encoded), "truncated payload must still be valid JSON");
  });

  it("marks a truncated payload and reports the surviving count", () => {
    const result = retrievedRecords("invoices", "filter=overdue", Array.from({ length: 400 }, (_, i) => invoice(i)));
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.truncated, true);
    assert.equal(result.count, (result.data as unknown[]).length);
  });

  it("stays within the payload budget", () => {
    const result = retrievedRecords("invoices", "all", Array.from({ length: 400 }, (_, i) => invoice(i)));
    assert.ok(JSON.stringify(result).length < 6600);
  });

  it("leaves a small list untouched", () => {
    const result = retrievedRecords("invoices", "all", [{ id: 1 }, { id: 2 }]);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.equal(result.truncated, false);
    assert.equal(result.count, 2);
  });

  it("reports a single oversized record as unavailable, not empty", () => {
    // Records demonstrably exist, so "nothing here" would be a lie.
    const result = retrievedRecords("invoices", "all", [{ blob: "x".repeat(9000) }]);
    assert.equal(result.status, "unavailable");
  });
});

describe("retrieval envelope — failure is never absence", () => {
  it("distinguishes an empty result from an ok one", () => {
    assert.equal(retrievedRecords("invoices", "filter=overdue", []).status, "empty");
  });

  it("normalises an executor error into unavailable", () => {
    assert.equal(asRetrieval("invoices", "all", { error: "connection reset" }).status, "unavailable");
  });

  it("never lets unavailable carry data the model could read as records", () => {
    const result = retrievalUnavailable("invoices", "filter=overdue");
    assert.equal(result.status, "unavailable");
    assert.ok(!("data" in result));
    assert.ok(!("count" in result));
  });
});

describe("retrieval envelope — provenance", () => {
  it("stamps asOf on a successful read", () => {
    const result = retrievedRecords("invoices", "all", [{ id: 1 }]);
    assert.equal(result.status, "ok");
    if (result.status !== "ok") return;
    assert.ok(!Number.isNaN(Date.parse(result.asOf)));
  });

  it("stamps asOf on an empty read, so 'you have none' is still dated", () => {
    const result = retrievedRecords("invoices", "all", []);
    assert.equal(result.status, "empty");
    if (result.status !== "empty") return;
    assert.ok(!Number.isNaN(Date.parse(result.asOf)));
  });

  it("carries the scope so a filtered read is not summarised as the whole set", () => {
    const result = retrievedRecords("invoices", "filter=overdue", [{ id: 1 }]);
    assert.equal(result.scope, "filter=overdue");
  });
});

describe("retrieval envelope — shape normalisation", () => {
  it("unwraps a rows-shaped executor result", () => {
    assert.equal(asRetrieval("s", "sc", { rows: [{ a: 1 }] }).status, "ok");
  });

  it("treats empty rows as empty", () => {
    assert.equal(asRetrieval("s", "sc", { rows: [] }).status, "empty");
  });

  it("wraps an aggregate snapshot as a single value", () => {
    assert.equal(retrievedValue("snapshot", "12m", { revenue: 1 }).status, "ok");
  });

  it("treats a missing record as empty", () => {
    assert.equal(retrievedValue("snapshot", "12m", null).status, "empty");
  });
});
