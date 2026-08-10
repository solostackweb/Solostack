import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isProjectFollowupRequest, planIvoRuntime } from "../runtime-planner";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOMAIN_SOURCE = readFileSync(path.join(ROOT, "prepared-actions.ts"), "utf8");
const TOOL_SOURCE = readFileSync(path.join(ROOT, "tool-actions.ts"), "utf8");
const CONVERSATION_SOURCE = readFileSync(path.join(ROOT, "conversation-actions.ts"), "utf8");
const PANEL_SOURCE = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");

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

test("a named project reminder becomes a prepared email rather than plain advice", () => {
  const clientId = "4d08b55f-33b8-4416-b0d9-f87a458e9471";
  assert.equal(isProjectFollowupRequest("Send reminder to Priya"), true);
  assert.equal(isProjectFollowupRequest("Send an overdue invoice reminder to Priya"), false);
  assert.deepEqual(planIvoRuntime({
    message: "Send reminder to Priya",
    interpretation: {
      intent: "general",
      confident: true,
      fields: {},
      clientId,
      provider: "local",
    },
    currentMode: "general",
    collected: {},
    clientId: "",
    projectId: "",
    requestId: "0aa90aa8-7145-48f0-8a39-830123968c0c",
  }), { kind: "project_followup", clientId });

  const direct = CONVERSATION_SOURCE.indexOf("isProjectFollowupRequest(parsed.data.message)");
  const agent = CONVERSATION_SOURCE.indexOf("const agent = await runIvoAgent");
  assert.ok(direct >= 0 && direct < agent);
  assert.match(PANEL_SOURCE, /type: "prepared_action"/);
  assert.match(PANEL_SOURCE, /yes, send this/);
  assert.match(DOMAIN_SOURCE, /prepareProjectFollowupAction/);
  assert.match(DOMAIN_SOURCE, /\.eq\("user_id", userId\)/);
  assert.match(DOMAIN_SOURCE, /\.eq\("client_id", parsed\.data\.clientId\)/);
});
