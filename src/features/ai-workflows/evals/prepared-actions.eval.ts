import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_SOURCE = readFileSync(path.join(ROOT, "prepared-actions.ts"), "utf8");
const TOOL_SOURCE = readFileSync(path.join(ROOT, "tool-actions.ts"), "utf8");

test("prepared-action domain operations are not public server actions", () => {
  assert.match(DOMAIN_SOURCE, /^import "server-only";/);
  assert.doesNotMatch(DOMAIN_SOURCE, /^"use server";/);
});

test("proactive detection applies explicit owner filters and prompt-injection guidance", () => {
  const detection = DOMAIN_SOURCE.slice(
    DOMAIN_SOURCE.indexOf("async function detectMoments"),
    DOMAIN_SOURCE.indexOf("// ---------------------------------------------------------------------------\n// Generation"),
  );
  assert.ok((detection.match(/\.eq\("user_id", userId\)/g) ?? []).length >= 6);
  assert.match(DOMAIN_SOURCE, /untrusted workspace data/);
});

test("prepared sends and dismissals enter through the audited tool runner", () => {
  assert.match(TOOL_SOURCE, /runPreparedActionTool\(\s*"prepared_action\.send"/);
  assert.match(TOOL_SOURCE, /runPreparedActionTool\(\s*"prepared_action\.dismiss"/);
  assert.match(TOOL_SOURCE, /approval_state: ivoToolApprovalState\(toolKey\)/);
  assert.match(TOOL_SOURCE, /status: succeeded \? "succeeded" : "failed"/);
});
