import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  evaluateAutomation,
  filterNewCandidates,
} from "../../automation/evaluator-core";
import type {
  AutomationCandidate,
  EvaluatorSnapshot,
  InvoiceInput,
} from "../../automation/evaluator-core";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORE_SOURCE = readFileSync(
  path.join(ROOT, "../automation/evaluator-core.ts"),
  "utf8",
);
const SERVER_SOURCE = readFileSync(
  path.join(ROOT, "../automation/server.ts"),
  "utf8",
);
const REFRESH_SOURCE = readFileSync(
  path.join(ROOT, "../automation/refresh-core.ts"),
  "utf8",
);
const ACTION_SOURCE = readFileSync(
  path.join(ROOT, "../automation/automation-actions.ts"),
  "utf8",
);

const NOW = new Date("2026-08-15T12:00:00.000Z");

function invoice(partial: Partial<InvoiceInput>): InvoiceInput {
  return {
    id: "inv-1",
    invoice_number: "INV-0001",
    total_amount: 100000,
    currency: "INR",
    due_date: "2026-08-10",
    ...partial,
  };
}

function emptySnapshot(): EvaluatorSnapshot {
  return { overdueInvoices: [], dueSoonInvoices: [], staleProposals: [], unbilled: null, expiringContracts: [] };
}

function keyCount(candidates: AutomationCandidate[], trigger: string): number {
  return new Set(
    candidates.filter((c) => c.triggerKey === trigger).map((c) => c.dedupeKey),
  ).size;
}

test("evaluator-core is a pure server-only module, not a client action", () => {
  assert.match(CORE_SOURCE, /^import "server-only";/);
  assert.doesNotMatch(CORE_SOURCE, /^"use server";/);
});

test("server.ts reroutes through the pure evaluator core and persists to both tables", () => {
  // server.ts (session path) delegates to the shared client-agnostic core.
  assert.match(SERVER_SOURCE, /import\s*\{[^}]*refreshForUser/s);
  assert.match(SERVER_SOURCE, /refreshForUser\(\s*supabase,\s*userId/s);
  // The core drives the pure evaluator and writes the durable artifacts.
  assert.match(REFRESH_SOURCE, /import\s*\{[^}]*evaluateAutomation/s);
  assert.match(REFRESH_SOURCE, /from\("automation_suggestions"\)\.insert/s);
  // Runs are written with a code-side dedupe guard (select existing by the
  // moment, then insert) rather than a postgREST `onConflict` upsert, which
  // cannot target the partial unique index migration 0085 declares. This
  // still guarantees one run per dedupe key for the same moment.
  assert.match(REFRESH_SOURCE, /from\("automation_runs"\)\s*\.select\("id"\)/s);
  assert.match(REFRESH_SOURCE, /\.eq\("dedupe_key", candidate\.dedupeKey\)/s);
  assert.match(REFRESH_SOURCE, /from\("automation_runs"\)\.insert/s);
  assert.match(REFRESH_SOURCE, /filterNewCandidates/);
});

test("Today controls are owner-scoped and snoozed moments stay deduped but hidden", () => {
  assert.match(SERVER_SOURCE, /snoozeAutomationSuggestion/);
  assert.match(SERVER_SOURCE, /dismissAutomationSuggestion/);
  assert.match(SERVER_SOURCE, /disableAutomationSuggestionRecipe/);
  assert.match(SERVER_SOURCE, /\.eq\("user_id", owned\.userId\)/);
  assert.match(ACTION_SOURCE, /until > now \+ 30 \* 86_400_000/);
  assert.match(REFRESH_SOURCE, /\.in\("status", \["pending", "approved", "dismissed"\]\)/);
  assert.match(REFRESH_SOURCE, /expires_at\.is\.null,expires_at\.lte/);
  assert.match(REFRESH_SOURCE, /\.update\(\{ dedupe_key: null \}/);
});

test("one run per dedupe key no matter how many source rows trigger alike", () => {
  const snapshot = emptySnapshot();
  snapshot.overdueInvoices = [
    invoice({ id: "inv-a", invoice_number: "INV-A" }),
    invoice({ id: "inv-b", invoice_number: "INV-B" }),
    invoice({ id: "inv-a", invoice_number: "INV-A" }),
  ];
  const candidates = evaluateAutomation(snapshot, NOW);
  assert.equal(keyCount(candidates, "invoice_overdue_followup"), 2);
});

test("evaluation is idempotent across repeated runs on the same snapshot", () => {
  const snapshot = emptySnapshot();
  snapshot.overdueInvoices = [invoice({ id: "inv-x", invoice_number: "INV-X" })];
  snapshot.dueSoonInvoices = [
    invoice({ id: "inv-y", invoice_number: "INV-Y", due_date: "2026-08-17" }),
  ];
  const first = evaluateAutomation(snapshot, NOW);
  const second = evaluateAutomation(snapshot, NOW);
  assert.deepEqual(first, second);
  assert.equal(keyCount(first, "invoice_overdue_followup"), 1);
  assert.equal(keyCount(first, "invoice_due_soon_review"), 1);
});

test("disabled recipe suppresses its trigger but keeps the rest", () => {
  const snapshot = emptySnapshot();
  snapshot.overdueInvoices = [invoice({ id: "inv-1", invoice_number: "INV-1" })];
  snapshot.dueSoonInvoices = [
    invoice({ id: "inv-2", invoice_number: "INV-2", due_date: "2026-08-17" }),
  ];
  const candidates = evaluateAutomation(snapshot, NOW, {
    invoice_overdue_followup: false,
  });
  assert.equal(keyCount(candidates, "invoice_overdue_followup"), 0);
  assert.equal(keyCount(candidates, "invoice_due_soon_review"), 1);
});

test("filterNewCandidates drops anything already live, keeps the rest", () => {
  const live = new Set(["invoice_overdue_followup:inv-1"]);
  const a = invoice({ id: "inv-1", invoice_number: "INV-1" });
  const b = invoice({ id: "inv-2", invoice_number: "INV-2" });
  const candidates = evaluateAutomation(
    { ...emptySnapshot(), overdueInvoices: [a, b] },
    NOW,
  );
  const fresh = filterNewCandidates(candidates, live);
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].entityId, "inv-2");
});

test("enabled-only respects an all-disabled map (nothing fires)", () => {
  const snapshot = emptySnapshot();
  snapshot.overdueInvoices = [invoice({ id: "inv-1" })];
  const none = evaluateAutomation(snapshot, NOW, {
    invoice_overdue_followup: false,
    invoice_due_soon_review: false,
    proposal_followup: false,
    unbilled_time_invoice: false,
    contract_expiry_followup: false,
  });
  assert.deepEqual(none, []);
});

test("unbilled hours produce exactly one workspace-level candidate", () => {
  const snapshot = emptySnapshot();
  snapshot.unbilled = { totalAmount: 50000, totalHours: 12.5 };
  const candidates = evaluateAutomation(snapshot, NOW);
  assert.equal(keyCount(candidates, "unbilled_time_invoice"), 1);
  const cand = candidates.find((c) => c.triggerKey === "unbilled_time_invoice")!;
  assert.equal(cand.entityId, "workspace");
  assert.equal(cand.dedupeKey, "unbilled_time_invoice:workspace");
});

test("zero unbilled value fires nothing", () => {
  const snapshot = emptySnapshot();
  snapshot.unbilled = { totalAmount: 0, totalHours: 0 };
  assert.equal(
    keyCount(evaluateAutomation(snapshot, NOW), "unbilled_time_invoice"),
    0,
  );
});

test("contracts expiring within a week surface a follow-up", () => {
  const snapshot = emptySnapshot();
  snapshot.expiringContracts = [
    { id: "c-1", title: "Acme retainer", expires_at: "2026-08-20T00:00:00.000Z" },
    { id: "c-2", title: "Far contract", expires_at: "2026-10-01T00:00:00.000Z" },
  ];
  const candidates = evaluateAutomation(snapshot, NOW);
  const expiring = candidates.filter((c) => c.triggerKey === "contract_expiry_followup");
  assert.equal(expiring.length, 1);
  assert.equal(expiring[0].entityId, "c-1");
});
