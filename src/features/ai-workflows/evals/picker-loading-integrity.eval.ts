import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const PANEL = readFileSync(
  path.join(process.cwd(), "src/features/ai-workflows/components/stackivo-ai-assistant.tsx"),
  "utf8",
);

test("entry-point workflows await the same picker-options request warmed on open", () => {
  assert.match(PANEL, /pickerOptionsPromiseRef = React\.useRef<Promise<PickerOptionsSnapshot> \| null>/);
  assert.match(PANEL, /const ensurePickerOptions = React\.useCallback/);
  // The read travels over a plain GET (the server-action transport could drop
  // the dispatch / never resolve the caller promise), but it is still issued
  // once inside the shared single-flight guard.
  assert.match(PANEL, /if \(!pickerOptionsPromiseRef\.current\)[\s\S]*?\/api\/ivo\/picker-options/);
  assert.match(PANEL, /if \(!open\) return;[\s\S]*?ensurePickerOptions\(\)\.catch/);
  assert.match(
    PANEL,
    /if \(nextAction\.prompt\.type === "picker"\)[\s\S]*?options = await ensurePickerOptions\(\)/,
  );
});

test("new pickers render the resolved snapshot instead of stale component state", () => {
  assert.match(PANEL, /const availableClients = options\.clients/);
  assert.match(PANEL, /clients=\{availableClients\}/);
  assert.match(PANEL, /const availableProjects = cId[\s\S]*?options\.projects\.filter/);
  assert.match(PANEL, /projects=\{availableProjects\}/);
});

test("a failed options request is retryable and never appears as an empty workspace", () => {
  assert.match(PANEL, /pickerOptionsPromiseRef\.current = null;[\s\S]*?throw error/);
  assert.match(PANEL, /I couldn't load your workspace options just now\. Please try again\./);
});
