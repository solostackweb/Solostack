import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const AGENT = readFileSync(new URL("../agent.ts", import.meta.url), "utf8");
const PROMPT = readFileSync(new URL("../agent-prompt.ts", import.meta.url), "utf8");
const PLANNER = readFileSync(new URL("../runtime-planner.ts", import.meta.url), "utf8");
const PORTAL_PAGE = readFileSync(
  new URL("../../portals/components/portal-index-view.tsx", import.meta.url),
  "utf8",
);

test("portal planning reads portal coverage and real client work signals", () => {
  assert.match(AGENT, /name: "assess_portal_candidates"/);
  assert.match(AGENT, /from\("portals"\)/);
  assert.match(AGENT, /activeProjects/);
  assert.match(AGENT, /openInvoices/);
  assert.match(AGENT, /pendingContracts/);
  assert.match(AGENT, /pendingProposals/);
  assert.match(AGENT, /upcomingMeetings/);
  assert.match(AGENT, /welcomeDocuments/);
});

test("portal-gap questions cannot degrade into the generic client directory", () => {
  assert.match(AGENT, /isPortalPlanningRequest\(input\.message\) && tool\.function\.name === "show_records"/);
  assert.match(PROMPT, /Never answer these requests with show_records or a generic client list/);
  assert.match(PLANNER, /show && !portalPlanning/);
});

test("the portal page asks IVo for an evidence-based comparison", () => {
  assert.match(PORTAL_PAGE, /Review each client's active projects and shared work/);
  assert.match(PORTAL_PAGE, /recommend who should get a portal next and explain why/);
});
