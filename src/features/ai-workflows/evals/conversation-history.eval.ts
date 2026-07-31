import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "conversation-actions.ts"),
  "utf8",
);

function functionSource(name: string, nextName: string): string {
  const start = SOURCE.indexOf(`export async function ${name}`);
  const end = SOURCE.indexOf(`export async function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must end before ${nextName}`);
  return SOURCE.slice(start, end);
}

test("conversation history is always scoped to the signed-in owner", () => {
  const list = functionSource("listIvoConversationsAction", "switchIvoConversationAction");
  assert.match(list, /\.eq\("user_id", userId\)/);
  assert.match(list, /\.limit\(20\)/);
});

test("conversation switching verifies ownership and restores the prior active thread on failure", () => {
  const source = functionSource("switchIvoConversationAction", "appendIvoMessageAction");
  assert.match(source, /\.eq\("id", parsed\.data\.conversationId\)/);
  assert.match(source, /\.eq\("user_id", userId\)/);
  assert.match(source, /if \(previous\)/);
  assert.match(source, /update\(\{ status: "active" \}/);
  assert.match(source, /readSnapshot\(activatedData/);
});
