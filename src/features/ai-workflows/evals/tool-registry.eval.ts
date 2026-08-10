import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  HIGH_RISK,
  IVO_TOOL_KEYS,
  IVO_TOOL_REGISTRY,
  assertIvoToolPath,
  ivoToolApprovalState,
  ivoToolPolicy,
  ivoToolSpec,
  type IvoToolKey,
} from "../tool-registry";
import { IVO_WORKFLOW_TOOLS } from "../conversation-types";

/**
 * The registry is only a safety control if it cannot drift from the code.
 *
 * These cases enforce two things a reviewer would otherwise have to check by
 * hand: that every tool key actually executed by `tool-actions.ts` is declared
 * here, and that the risk classes imply the approval rules the roadmap commits
 * to — specifically that nothing which reaches a client or moves money can run
 * without an explicit, previewed approval.
 */

const TOOL_ACTIONS_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tool-actions.ts"),
  "utf8",
);

/**
 * Tool keys the runtime actually executes, read out of the source.
 *
 * Deliberately does NOT filter by the registry — that would make the
 * completeness check vacuous, since an undeclared key would simply not match
 * and never be reported. Instead this reads the identifier each runner is
 * called with, so a new tool that skips its declaration is caught.
 */
function toolKeysUsedInSource(): string[] {
  const found = new Set<string>();
  // First string argument of any `run*Tool(` call, with optional type params.
  for (const match of TOOL_ACTIONS_SOURCE.matchAll(
    /\brun[A-Za-z]*Tool\s*(?:<[^>]*>)?\s*\(\s*"([^"]+)"/g,
  )) {
    found.add(match[1]);
  }
  // Keys written straight into the ledger by a bespoke runner.
  for (const match of TOOL_ACTIONS_SOURCE.matchAll(/tool_key:\s*"([^"]+)"/g)) {
    found.add(match[1]);
  }
  return [...found];
}

describe("tool registry — completeness", () => {
  it("declares every tool key the runtime executes", () => {
    for (const key of toolKeysUsedInSource()) {
      assert.ok(
        key in IVO_TOOL_REGISTRY,
        `"${key}" is used in tool-actions.ts but not declared in the registry`,
      );
    }
  });

  it("has no declared tool that the runtime never uses", () => {
    // A stale entry is a lie about the surface area, which is as bad for an
    // audit as a missing one.
    const used = new Set(toolKeysUsedInSource());
    for (const key of IVO_TOOL_KEYS) {
      assert.ok(used.has(key), `"${key}" is declared but never used in tool-actions.ts`);
    }
  });

  it("declares every workflow tool the planner can ask the panel to execute", () => {
    for (const key of IVO_WORKFLOW_TOOLS) {
      assert.ok(
        key in IVO_TOOL_REGISTRY,
        `workflow tool "${key}" is executable but missing from the registry`,
      );
    }
  });

  it("keys its own entries consistently", () => {
    for (const key of IVO_TOOL_KEYS) {
      assert.equal(IVO_TOOL_REGISTRY[key].key, key);
    }
  });

  it("throws rather than defaulting for an undeclared tool", () => {
    // Defaulting would let a new tool execute with an undefined policy.
    assert.throws(() => ivoToolSpec("invoice.definitely_not_a_tool" as IvoToolKey));
  });
});

describe("tool registry — approval policy", () => {
  it("requires explicit approval for everything that reaches a client or moves money", () => {
    for (const key of IVO_TOOL_KEYS) {
      const tool = IVO_TOOL_REGISTRY[key];
      if (!HIGH_RISK.has(tool.risk)) continue;
      assert.equal(
        tool.requiresApproval,
        true,
        `${key} is ${tool.risk} and must require explicit approval`,
      );
    }
  });

  it("requires approval before preparing a share link", () => {
    // The link embeds a public token; minting one is a disclosure decision.
    for (const key of IVO_TOOL_KEYS) {
      const tool = IVO_TOOL_REGISTRY[key];
      if (tool.risk !== "share_preparation") continue;
      assert.equal(tool.requiresApproval, true, key);
    }
  });

  it("exempts only draft creation and refinement from approval", () => {
    // Drafts are exempt because the draft IS the approval surface: nothing has
    // left the workspace and the record can be discarded.
    for (const key of IVO_TOOL_KEYS) {
      const tool = IVO_TOOL_REGISTRY[key];
      if (tool.requiresApproval) continue;
      assert.ok(
        tool.risk === "internal_draft" || tool.risk === "draft_refinement",
        `${key} is exempt from approval but is classed ${tool.risk}`,
      );
    }
  });

  it("verifies every successful action by rereading canonical data", () => {
    for (const key of IVO_TOOL_KEYS) {
      assert.equal(IVO_TOOL_REGISTRY[key].verifyByReread, true, key);
    }
  });
});

describe("tool registry — the gate actually fires", () => {
  // A guard nobody tests is a guard that silently stops working. These assert
  // the enforcement itself, not just the declarations it reads.

  it("records the declared approval state, never a hardcoded one", () => {
    for (const key of IVO_TOOL_KEYS) {
      const expected = IVO_TOOL_REGISTRY[key].requiresApproval ? "approved" : "not_required";
      assert.equal(ivoToolApprovalState(key), expected, key);
    }
  });

  it("throws when an approval-required tool runs through the draft path", () => {
    // This is the realistic failure: a new delivery tool added next to the
    // draft helpers because they looked similar.
    for (const key of IVO_TOOL_KEYS) {
      if (!IVO_TOOL_REGISTRY[key].requiresApproval) continue;
      assert.throws(
        () => assertIvoToolPath(key, "draft"),
        /executing through the "draft" path/,
        `${key} must not be allowed through the draft path`,
      );
    }
  });

  it("throws when a draft tool runs through the approved path", () => {
    // The reverse also matters: it would write an audit row claiming the user
    // approved something they were never shown.
    for (const key of IVO_TOOL_KEYS) {
      if (IVO_TOOL_REGISTRY[key].requiresApproval) continue;
      assert.throws(() => assertIvoToolPath(key, "approved"), `${key}`);
    }
  });

  it("permits every tool through its own declared path", () => {
    for (const key of IVO_TOOL_KEYS) {
      const path = IVO_TOOL_REGISTRY[key].requiresApproval ? "approved" : "draft";
      assert.doesNotThrow(() => assertIvoToolPath(key, path), key);
    }
  });

  it("wires every runner to the guard", () => {
    // Counts the guard calls in the source: one per runner plus the import.
    const guardCalls = TOOL_ACTIONS_SOURCE.match(/assertIvoToolPath\(/g) ?? [];
    assert.ok(
      guardCalls.length >= 6,
      `expected every runner to call assertIvoToolPath, found ${guardCalls.length}`,
    );
  });

  it("leaves no hardcoded approval_state on a ledger insert", () => {
    // A literal on an INSERT would bypass the registry entirely. Updates are a
    // different matter: the confirmation path legitimately transitions an
    // existing row from "required" to "approved" once the user confirms, and
    // the proposal path writes "required" before any approval exists. Only the
    // creating write is checked here.
    const inserts = TOOL_ACTIONS_SOURCE.match(/\.insert\(\{[\s\S]*?\}\s*as never\)/g) ?? [];
    assert.ok(inserts.length > 0, "expected to find ledger inserts to check");
    for (const block of inserts) {
      const hardcoded = block.match(/approval_state:\s*"(approved|not_required)"/);
      assert.equal(
        hardcoded,
        null,
        `approval_state must come from the registry on insert, found: ${hardcoded?.[0]}`,
      );
    }
  });
});

describe("tool registry — classification", () => {
  it("classes both invoice money-state changes as financial", () => {
    // Approving makes an invoice a receivable; marking paid closes it. Both
    // change what the user believes they are owed.
    assert.equal(IVO_TOOL_REGISTRY["invoice.approve"].risk, "financial");
    assert.equal(IVO_TOOL_REGISTRY["invoice.mark_paid"].risk, "financial");
  });

  it("classes every email and bulk reminder tool as external delivery", () => {
    for (const key of ["invoice.email", "proposal.email", "contract.email", "welcome_document.email", "invoice.remind_one", "invoice.remind_overdue", "meeting.create", "portal.create_invite", "questionnaire.send"] as const) {
      assert.equal(IVO_TOOL_REGISTRY[key].risk, "external_delivery", key);
    }
  });

  it("registers proposal drafts as reviewable internal work", () => {
    assert.equal(IVO_TOOL_REGISTRY["proposal.create"].risk, "internal_draft");
    assert.equal(IVO_TOOL_REGISTRY["proposal.create"].requiresApproval, false);
  });

  it("gives every tool a non-empty policy label for the ledger", () => {
    for (const key of IVO_TOOL_KEYS) {
      assert.ok(ivoToolPolicy(key).length > 0, key);
    }
  });

  it("uses one policy label per risk class", () => {
    // Divergent labels for the same class make the ledger hard to query.
    const byRisk = new Map<string, Set<string>>();
    for (const key of IVO_TOOL_KEYS) {
      const tool = IVO_TOOL_REGISTRY[key];
      // Bulk delivery is deliberately distinguished from single delivery.
      if (key === "invoice.remind_overdue") continue;
      const set = byRisk.get(tool.risk) ?? new Set<string>();
      set.add(tool.policy);
      byRisk.set(tool.risk, set);
    }
    for (const [risk, policies] of byRisk) {
      assert.equal(policies.size, 1, `${risk} has divergent policy labels: ${[...policies].join(", ")}`);
    }
  });
});
