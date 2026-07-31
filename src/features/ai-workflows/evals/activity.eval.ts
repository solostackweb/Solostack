import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ACTION_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "receipt-actions.ts"),
  "utf8",
);
const AGENT_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "agent.ts"),
  "utf8",
);

test("activity reads both runs and actions through explicit user ownership filters", () => {
  const start = ACTION_SOURCE.indexOf("export async function listIvoActivityAction");
  assert.ok(start >= 0);
  const source = ACTION_SOURCE.slice(start);
  assert.match(source, /from\("ivo_action_attempts"\)/);
  assert.match(source, /from\("ivo_runs"\)/);
  assert.ok((source.match(/\.eq\("user_id", user\.id\)/g) ?? []).length >= 2);
});

test("agent stores compact read provenance, not retrieved record payloads", () => {
  assert.match(AGENT_SOURCE, /reads\.push\(\{/);
  assert.match(AGENT_SOURCE, /tool: call\.function\.name/);
  assert.match(AGENT_SOURCE, /scope: retrievalScope/);
  assert.match(AGENT_SOURCE, /status: envelope\.status/);
  const trace = AGENT_SOURCE.slice(AGENT_SOURCE.indexOf("reads.push({"), AGENT_SOURCE.indexOf("reads.push({") + 250);
  assert.doesNotMatch(trace, /output|content|envelope\.data/);
});
