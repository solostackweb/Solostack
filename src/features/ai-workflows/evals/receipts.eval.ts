import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIvoReceipt,
  receiptHref,
  receiptStatus,
  type IvoLedgerRow,
} from "../receipts";
import { IVO_TOOL_KEYS, IVO_TOOL_REGISTRY } from "../tool-registry";

/**
 * A receipt is what lets a user check Ivo's work against the canonical record
 * instead of taking "done" on trust. These cases protect the properties that
 * makes it worth having: it must cover every tool, it must never point at a
 * record that does not exist, and it must not quietly report a failure as a
 * success.
 */

const row = (overrides: Partial<IvoLedgerRow> = {}): IvoLedgerRow => ({
  id: "att-1",
  tool_key: "invoice.email",
  entity_id: "11111111-1111-4111-8111-111111111111",
  status: "succeeded",
  created_at: "2026-07-28T10:00:00.000Z",
  ...overrides,
});

describe("receipts — coverage", () => {
  it("produces a receipt for every declared tool", () => {
    for (const key of IVO_TOOL_KEYS) {
      const receipt = buildIvoReceipt(row({ tool_key: key }));
      assert.ok(receipt, `${key} produced no receipt`);
    }
  });

  it("gives every tool a distinct, non-empty summary", () => {
    const summaries = new Set<string>();
    for (const key of IVO_TOOL_KEYS) {
      const receipt = buildIvoReceipt(row({ tool_key: key }));
      assert.ok(receipt && receipt.summary.length > 0, key);
      summaries.add(receipt!.summary);
    }
    // Two tools sharing a summary would make the audit trail ambiguous.
    assert.equal(summaries.size, IVO_TOOL_KEYS.length);
  });

  it("carries the registry's risk and approval classification", () => {
    for (const key of IVO_TOOL_KEYS) {
      const receipt = buildIvoReceipt(row({ tool_key: key }))!;
      assert.equal(receipt.risk, IVO_TOOL_REGISTRY[key].risk, key);
      assert.equal(receipt.requiredApproval, IVO_TOOL_REGISTRY[key].requiresApproval, key);
    }
  });

  it("drops a row for a tool that is no longer declared", () => {
    // Better an absent entry than one with invented metadata.
    assert.equal(buildIvoReceipt(row({ tool_key: "invoice.removed_long_ago" })), null);
  });
});

describe("receipts — links", () => {
  it("links to the affected record for every entity with a detail page", () => {
    for (const entityType of ["invoice", "contract", "welcome_document", "client", "project"] as const) {
      const href = receiptHref(entityType, "abc");
      assert.ok(href?.startsWith("/dashboard/"), `${entityType} -> ${href}`);
    }
  });

  it("returns no link rather than a broken one", () => {
    // A dead link in an audit trail is worse than an honest absence.
    for (const entityType of ["time_entry", "support_ticket", "welcome_document_template"] as const) {
      assert.equal(receiptHref(entityType, "abc"), null, entityType);
    }
  });

  it("returns no link when the entity id is missing", () => {
    assert.equal(receiptHref("invoice", null), null);
  });

  it("never emits a link containing an undefined segment", () => {
    for (const key of IVO_TOOL_KEYS) {
      const receipt = buildIvoReceipt(row({ tool_key: key, entity_id: null }))!;
      assert.equal(receipt.href, null, key);
    }
  });
});

describe("receipts — status honesty", () => {
  it("reports a successful attempt as succeeded", () => {
    assert.equal(receiptStatus("succeeded"), "succeeded");
  });

  it("reports in-flight work as in progress, not success", () => {
    assert.equal(receiptStatus("executing"), "in_progress");
    assert.equal(receiptStatus("proposed"), "in_progress");
  });

  it("reports a cancelled attempt as cancelled", () => {
    assert.equal(receiptStatus("cancelled"), "cancelled");
  });

  it("treats an unrecognised ledger status as failed, never as success", () => {
    // Defaulting the other way would let a new or corrupted state read as
    // "done" in the one place the user goes to verify what happened.
    for (const status of ["failed", "", "weird_new_state", "SUCCEEDED"]) {
      assert.equal(receiptStatus(status), "failed", status);
    }
  });
});
