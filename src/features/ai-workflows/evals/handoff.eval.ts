import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { IVO_TOOL_REGISTRY } from "../tool-registry";

const ROOT = path.resolve(process.cwd(), "src/features/ai-workflows");
const DOMAIN = readFileSync(path.join(ROOT, "domain-operations.ts"), "utf8");
const TOOLS = readFileSync(path.join(ROOT, "tool-actions.ts"), "utf8");
const ASSISTANT = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");
const PREVIEWS = readFileSync(path.join(ROOT, "components/assistant-previews.tsx"), "utf8");

describe("Ivo accepted-proposal handoff", () => {
  it("only converts proposals after canonical acceptance", () => {
    const guard = DOMAIN.match(/async function requireAcceptedProposal[\s\S]*?\n}\n/)?.[0] ?? "";
    assert.match(guard, /\.from\("proposals"\)/);
    assert.match(guard, /status !== "accepted"/);
    assert.match(DOMAIN, /convertProposalToContractAction\(\{ id: parsed\.data\.proposalId \}\)/);
    assert.match(DOMAIN, /convertProposalToProjectAction\(\{ id: parsed\.data\.proposalId \}\)/);
  });

  it("uses approval-gated, replay-safe tools for both conversions", () => {
    for (const key of ["proposal.convert_contract", "proposal.convert_project"] as const) {
      assert.equal(IVO_TOOL_REGISTRY[key].requiresApproval, true, key);
      assert.equal(IVO_TOOL_REGISTRY[key].verifyByReread, true, key);
      assert.match(TOOLS, new RegExp(`"${key.replace(".", "\\.")}"`));
    }
    assert.match(TOOLS, /const requestKey = `\$\{toolKey\}:\$\{parsed\.data\.entityId\}`/);
  });

  it("offers the next handoff operations only on accepted proposal cards", () => {
    const proposalCard = PREVIEWS.match(/export function ProposalListBlock[\s\S]*?export function ClientListBlock/)?.[0] ?? "";
    assert.match(proposalCard, /row\.status === "accepted"/);
    assert.match(proposalCard, /onCreateContract\(row\.id\)/);
    assert.match(proposalCard, /onStartProject\(row\.id\)/);
  });

  it("treats portal creation plus invitation as explicit external delivery", () => {
    const tool = IVO_TOOL_REGISTRY["portal.create_invite"];
    assert.equal(tool.risk, "external_delivery");
    assert.equal(tool.requiresApproval, true);
    assert.match(ASSISTANT, /tools\.createProjectPortal\(id\)/);
    assert.match(PREVIEWS, /Create portal &amp; invite/);
  });

  it("hydrates existing portals instead of offering duplicate creation", () => {
    const projectList = DOMAIN.match(/export async function listProjectsForAiAction[\s\S]*?\n}\n/)?.[0] ?? "";
    assert.match(projectList, /\.from\("portals"\)/);
    assert.match(projectList, /portalIdByClientId/);
    assert.match(PREVIEWS, /r\.portalId \?/);
    assert.match(PREVIEWS, /Open portal/);
  });
});
