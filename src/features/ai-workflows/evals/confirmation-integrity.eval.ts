import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "src/features/ai-workflows");
const PANEL = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");
const TYPES = readFileSync(path.join(ROOT, "conversation-types.ts"), "utf8");
const ACTIONS = readFileSync(path.join(ROOT, "conversation-actions.ts"), "utf8");
const PREVIEWS = readFileSync(path.join(ROOT, "components/assistant-previews.tsx"), "utf8");

test("confirmation preserves the exact previewed prompt for every approval path", () => {
  assert.match(TYPES, /interface IvoPendingConfirmation[\s\S]*?prompt: string;/);
  assert.match(ACTIONS, /prompt: z\.string\(\)\.max\(6000\)\.default\(""\)/);
  assert.match(PANEL, /setPendingConfirm\(\{[\s\S]*?prompt: text,[\s\S]*?toolRequestKey:/);
  assert.match(PANEL, /pc\.pId,[\s\S]*?pc\.prompt,[\s\S]*?true,/);
  assert.match(PANEL, /confirmation\.pId,[\s\S]*?confirmation\.prompt,[\s\S]*?true,/);
});

test("saved confirmations created before prompt persistence recover their preview instruction", () => {
  assert.match(PANEL, /let restoredPendingConfirmation = state\.pendingConfirmation/);
  assert.match(PANEL, /if \(restoredPendingConfirmation && !restoredPendingConfirmation\.prompt\)/);
  assert.match(PANEL, /\.slice\(0, confirmationIndex >= 0 \? confirmationIndex : undefined\)/);
  assert.match(PANEL, /\.find\(\(message\) => message\.role === "user"\)\?\.content/);
  assert.match(PANEL, /setPendingConfirm\(restoredPendingConfirmation\)/);
});

test("a confirmation card is canonical immediately and becomes inert when consumed", () => {
  assert.match(PANEL, /persistedBlock: \{[\s\S]*?type: "confirmation"/);
  assert.match(PANEL, /const active = pendingConfirmRef\.current\?\.toolRequestKey === block\.requestId/);
  assert.match(PANEL, /disabled=\{!active\}/);
  assert.match(PREVIEWS, /disabled \? "No longer available" : "Confirm & create"/);
});
