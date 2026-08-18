import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "src/features/ai-workflows/components");
const PREVIEWS = readFileSync(path.join(ROOT, "assistant-previews.tsx"), "utf8");
const PANEL = readFileSync(path.join(ROOT, "stackivo-ai-assistant.tsx"), "utf8");

test("client cards expose all four contextual actions", () => {
  const clientBlock = PREVIEWS.slice(
    PREVIEWS.indexOf("export function ClientListBlock"),
    PREVIEWS.indexOf("export function ProjectListBlock"),
  );
  assert.match(clientBlock, /> Open/);
  assert.match(clientBlock, /> Invoice/);
  assert.match(clientBlock, /onContract\(r\.name\)[\s\S]*?> Contract/);
  assert.match(clientBlock, /onMeeting\(r\.name\)[\s\S]*?> Meeting/);
  assert.match(clientBlock, /flex flex-wrap/);
});

test("live and restored client lists launch client-scoped Ivo workflows", () => {
  assert.equal(
    PANEL.match(/onContract=\{\(name\) => submitRef\.current\?\.\(`Create a contract for \$\{name\}`\)\}/g)?.length,
    2,
  );
  assert.equal(
    PANEL.match(/onMeeting=\{\(name\) => submitRef\.current\?\.\(`Schedule a meeting with \$\{name\}`\)\}/g)?.length,
    2,
  );
});
