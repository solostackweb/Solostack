import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  AUTOMATION_TRIGGER_TOOL,
  AUTOMATION_EXTERNAL_TRIGGERS,
  AUTOMATION_DRAFT_TRIGGERS,
} from "../../automation/trigger-map";
import type { AutomationTriggerKey } from "../../automation/evaluator-core";
import { IVO_TOOL_KEYS, ivoToolSpec } from "../tool-registry";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXECUTOR_SOURCE = readFileSync(path.join(ROOT, "../automation/executor.ts"), "utf8");
const CRON_SOURCE = readFileSync(
  path.join(ROOT, "../../app/api/cron/automation/route.ts"),
  "utf8",
);
const REFRESH_SOURCE = readFileSync(path.join(ROOT, "../automation/refresh-core.ts"), "utf8");

const TRIGGER_KEYS: AutomationTriggerKey[] = [
  "invoice_overdue_followup",
  "invoice_due_soon_review",
  "proposal_followup",
  "unbilled_time_invoice",
  "contract_expiry_followup",
];

test("every automation trigger maps to a declared, correctly-typed tool key", () => {
  for (const key of TRIGGER_KEYS) {
    const toolKey = AUTOMATION_TRIGGER_TOOL[key];
    assert.ok(toolKey, `missing tool mapping for ${key}`);
    assert.ok(
      (IVO_TOOL_KEYS as readonly string[]).includes(toolKey),
      `${key} -> ${toolKey} is not a declared tool key`,
    );
  }
});

test("external-delivery triggers require approval; the draft trigger does not", () => {
  assert.equal(AUTOMATION_EXTERNAL_TRIGGERS.size, 4);
  assert.equal(AUTOMATION_DRAFT_TRIGGERS.size, 1);
  for (const key of TRIGGER_KEYS) {
    const spec = ivoToolSpec(AUTOMATION_TRIGGER_TOOL[key]);
    if (AUTOMATION_EXTERNAL_TRIGGERS.has(key)) {
      assert.equal(spec.requiresApproval, true, `${key} must require explicit approval`);
    } else {
      assert.equal(spec.requiresApproval, false, `${key} must not require approval`);
    }
  }
});

test("the draft trigger (unbilled) creates a workspace draft, nothing leaves it", () => {
  const toolKey = AUTOMATION_TRIGGER_TOOL.unbilled_time_invoice;
  assert.equal(toolKey, "invoice.unbilled_draft");
  assert.equal(ivoToolSpec(toolKey).risk, "internal_draft");
  assert.ok(AUTOMATION_DRAFT_TRIGGERS.has("unbilled_time_invoice"));
});

test("the executor builds its runnable closures from the pure trigger map", () => {
  assert.match(EXECUTOR_SOURCE, /AUTOMATION_TRIGGER_TOOL\.invoice_overdue_followup/);
  assert.match(EXECUTOR_SOURCE, /AUTOMATION_TRIGGER_TOOL\.contract_expiry_followup/);
  assert.match(EXECUTOR_SOURCE, /remindInvoiceFromAiAction/);
  assert.match(EXECUTOR_SOURCE, /invoiceUnbilledTimeFromAiAction/);
  assert.match(EXECUTOR_SOURCE, /sendProposalFromAiAction/);
  assert.match(EXECUTOR_SOURCE, /sendContractFromAiAction/);
});

test("the executor claims the run atomically before executing, so a double-click cannot double-send", () => {
  assert.match(EXECUTOR_SOURCE, /status: "running"/);
  assert.match(EXECUTOR_SOURCE, /\.eq\("status", "queued"\)/);
  assert.match(EXECUTOR_SOURCE, /started_at: new Date\(\)\.toISOString\(\)/);
});

test("dismissed, snoozed, and recipe-disabled moments cannot execute from a stale client", () => {
  assert.match(EXECUTOR_SOURCE, /\.eq\("status", "pending"\)/);
  assert.match(EXECUTOR_SOURCE, /suggestion\.expires_at/);
  assert.match(EXECUTOR_SOURCE, /from\("automation_recipes"\)/);
  assert.match(EXECUTOR_SOURCE, /if \(!\(recipeRaw as \{ enabled\?: boolean \} \| null\)\?\.enabled\) return null/);
});

test("the audit row derives policy + approval state from the registry, never hardcoded", () => {
  assert.match(EXECUTOR_SOURCE, /ivoToolApprovalState\(toolKey\)/);
  assert.match(EXECUTOR_SOURCE, /ivoToolPolicy\(toolKey\)/);
  assert.match(EXECUTOR_SOURCE, /createHash\("sha256"\)/);
});

test("the audit write is idempotent on (user, run) so retries never stack duplicate rows", () => {
  assert.match(EXECUTOR_SOURCE, /\.upsert\(/);
  assert.match(EXECUTOR_SOURCE, /onConflict: "user_id,idempotency_key"/);
});

test("retry policy is bounded against MAX_RETRIES", () => {
  assert.match(EXECUTOR_SOURCE, /MAX_RETRIES\s*=\s*3/);
  assert.match(EXECUTOR_SOURCE, /retry_count\s*>=\s*MAX_RETRIES/);
  assert.match(EXECUTOR_SOURCE, /retry_count:\s*\(run\.retry_count\s*\+\s*1\)/);
});

test("the cron route only evaluates — never executes — and is secret-guarded", () => {
  assert.match(CRON_SOURCE, /refreshForUser/);
  assert.match(CRON_SOURCE, /getAdminSupabase/);
  assert.match(CRON_SOURCE, /recordCronRun\(\{\s*job: "automation"/s);
  assert.match(CRON_SOURCE, /Bearer/);
  assert.match(CRON_SOURCE, /status: 404/);
  assert.match(CRON_SOURCE, /status: 401/);
  assert.doesNotMatch(
    CRON_SOURCE,
    /executeAutomationRun|remindInvoiceFromAiAction|sendProposalFromAiAction|sendContractFromAiAction/,
  );
});

test("refresh-core reads are explicit user_id-scoped so the admin cron bypassing RLS stays safe", () => {
  const reads = REFRESH_SOURCE.match(/\.eq\("user_id", userId\)/g) ?? [];
  assert.ok(reads.length >= 6, `expected >=6 explicit user_id filters, got ${reads.length}`);
});
