import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const PROMPT = readFileSync(
  path.resolve(process.cwd(), "src/features/pwa/install-prompt.tsx"),
  "utf8",
);

describe("PWA install prompt route boundary", () => {
  it("uses a product allow-list so every public route is hidden by default", () => {
    assert.match(PROMPT, /SHOW_ON_PREFIXES = \["\/dashboard", "\/onboarding", "\/admin"\]/);
    assert.match(PROMPT, /return !SHOW_ON_PREFIXES\.some/);
    assert.doesNotMatch(PROMPT, /HIDE_ON_PREFIXES/);
  });
});
