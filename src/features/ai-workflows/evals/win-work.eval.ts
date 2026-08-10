import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import { planIvoRuntime } from "../runtime-planner";

const ROOT = path.resolve(process.cwd(), "src/features/ai-workflows");
const AGENT = readFileSync(path.join(ROOT, "agent.ts"), "utf8");
const ASSISTANT = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");
const DOMAIN = readFileSync(path.join(ROOT, "domain-operations.ts"), "utf8");
const TOOLS = readFileSync(path.join(ROOT, "tool-actions.ts"), "utf8");
const REQUEST_ID = "00000000-0000-4000-8000-000000000000";

function plan(message: string) {
  return planIvoRuntime({
    message,
    interpretation: { intent: "general", confident: false, fields: {}, provider: "local" },
    currentMode: "general",
    collected: {},
    clientId: "",
    projectId: "",
    requestId: REQUEST_ID,
  });
}

describe("Ivo win-work journey", () => {
  it("routes proposal lists separately from contracts", () => {
    assert.deepEqual(plan("show my proposals"), {
      kind: "list",
      entityType: "proposal",
      filter: "pending",
    });
    assert.deepEqual(plan("show all contracts"), {
      kind: "list",
      entityType: "contract",
      filter: "all",
    });
  });

  it("reads proposals from the canonical proposals table", () => {
    const branch = AGENT.match(/if \(entityType === "proposal"\)[\s\S]*?if \(entityType === "client"\)/)?.[0] ?? "";
    assert.match(branch, /\.from\("proposals"\)/);
    assert.doesNotMatch(branch, /\.from\("contracts"\)/);
  });

  it("uses a dedicated proposal delivery tool from the proposal card", () => {
    assert.match(ASSISTANT, /tools\.emailProposal\(id\)/);
    assert.match(TOOLS, /"proposal\.email"/);
    assert.match(TOOLS, /sendProposalFromAiAction\(\{ proposalId \}\)/);
  });

  it("verifies canonical sent status before reporting delivery success", () => {
    const operation = DOMAIN.match(/export async function sendProposalFromAiAction[\s\S]*?\n}\n/)?.[0] ?? "";
    assert.match(operation, /\.from\("proposals"\)/);
    assert.match(operation, /status === "sent"/);
  });

  it("keeps client briefings aware of dedicated proposals", () => {
    assert.match(AGENT, /proposals: \(\(proposalsRes\.data/);
  });
});
