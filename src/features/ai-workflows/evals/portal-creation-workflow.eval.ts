import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const TYPES = readFileSync(new URL("../types.ts", import.meta.url), "utf8");
const AGENT = readFileSync(new URL("../agent.ts", import.meta.url), "utf8");
const PROMPT = readFileSync(new URL("../agent-prompt.ts", import.meta.url), "utf8");
const NLU = readFileSync(new URL("../nlu.ts", import.meta.url), "utf8");
const DOMAIN = readFileSync(new URL("../domain-operations.ts", import.meta.url), "utf8");
const TOOLS = readFileSync(new URL("../tool-actions.ts", import.meta.url), "utf8");
const ASSISTANT = readFileSync(
  new URL("../components/stackivo-ai-assistant.tsx", import.meta.url),
  "utf8",
);

test("client portal is a first-class workflow and cannot degrade into project creation", () => {
  assert.match(TYPES, /"portal",\s*"time_entry"/);
  assert.match(TYPES, /portal: \[\{ field: "clientId" \}\]/);
  assert.match(NLU, /return \{ intent: "portal", leads: \/\^portal/);
  assert.match(PROMPT, /A client portal is task='portal' — never create a project as a substitute/);
  assert.match(AGENT, /A portal is its OWN task — never create a project named Client Portal/);
});

test("portal creation previews the recipient and canonical share plan", () => {
  assert.match(DOMAIN, /export async function createPortalFromAiAction/);
  assert.match(DOMAIN, /Create this portal and email the invitation\?/);
  assert.match(DOMAIN, /\["Share now", shareSummary\]/);
  assert.match(DOMAIN, /\.neq\("status", "draft"\)/);
  assert.match(DOMAIN, /createPortalAction\(\{/);
});

test("portal creation is approval-gated, persisted, and opens the real portal", () => {
  assert.match(TOOLS, /runCreateTool<PortalToolResult>/);
  assert.match(TOOLS, /"portal\.create_invite"/);
  assert.match(TOOLS, /entityType: "portal"/);
  assert.match(ASSISTANT, /case "portal\.create_invite"/);
  assert.match(ASSISTANT, /res\.needsConfirm\) showConfirm/);
  assert.match(ASSISTANT, /router\.push\(`\/dashboard\/portal\/\$\{res\.data\.id\}`\)/);
});
