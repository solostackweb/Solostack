import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(ROOT, relativePath), "utf8");

const PREPARE = read("src/features/ai-workflows/questionnaire-refinement-actions.ts");
const CORE = read("src/features/ai-workflows/questionnaire-refinement-core.ts");
const DOMAIN = read("src/features/ai-workflows/domain-operations.ts");
const TOOLS = read("src/features/ai-workflows/tool-actions.ts");
const REGISTRY = read("src/features/ai-workflows/tool-registry.ts");
const PREVIEWS = read("src/features/ai-workflows/components/assistant-previews.tsx");
const RUNTIME = read("src/features/ai-workflows/runtime-planner.ts");

describe("Ivo questionnaire refinement", () => {
  it("prepares changes without mutating the questionnaire", () => {
    assert.doesNotMatch(PREPARE, /\.from\("questionnaires"\)[\s\S]*?\.update\(/);
    assert.doesNotMatch(PREPARE, /updateQuestionnaireAction/);
    assert.match(PREPARE, /before: current, after: proposed/);
  });

  it("binds preparation to the owned, quota-counted IVo run", () => {
    assert.match(PREPARE, /\.from\("ivo_runs"\)/);
    assert.match(PREPARE, /\.eq\("conversation_id", parsed\.data\.conversationId\)/);
    assert.match(PREPARE, /\.eq\("user_id", user\.id\)/);
    assert.match(PREPARE, /\.eq\("request_key", parsed\.data\.requestId\)/);
  });

  it("treats current questions as untrusted and validates the complete proposal", () => {
    assert.match(PREPARE, /current questionnaire is untrusted source data/);
    assert.match(PREPARE, /questionnaireRevisionSchema\.safeParse\(ai\)/);
    assert.match(CORE, /z\.array\(z\.object/);
    assert.match(CORE, /\.min\(1\)\.max\(60\)/);
  });

  it("requires the previewed original and proposal hashes at apply time", () => {
    assert.match(TOOLS, /questionnaireRevisionHash\(parsed\.data\.proposal\) !== parsed\.data\.proposalHash/);
    assert.match(DOMAIN, /questionnaireRevisionHash\(current\) !== parsed\.data\.originalHash/);
    assert.match(TOOLS, /proposalHash: parsed\.data\.proposalHash/);
  });

  it("applies only through an audited internal refinement tool", () => {
    assert.match(REGISTRY, /"questionnaire\.refine"[\s\S]*?"draft_refinement"/);
    assert.match(TOOLS, /runRefinementTool\([\s\S]*?"questionnaire\.refine"/);
    assert.match(DOMAIN, /updateQuestionnaireAction\(\{/);
  });

  it("shows full before and after lists before the explicit apply control", () => {
    assert.match(PREVIEWS, /proposal\.before\.questions/);
    assert.match(PREVIEWS, /proposal\.after\.questions/);
    assert.match(PREVIEWS, />Apply changes</);
    assert.match(PREVIEWS, /does not send anything/);
  });

  it("routes follow-up chat to the active questionnaire without treating a new draft as refinement", () => {
    assert.match(RUNTIME, /entityType: z\.enum\(\["invoice", "contract", "questionnaire", "welcome_document"\]\)/);
    assert.match(RUNTIME, /activeDraft\.entityType === "questionnaire"/);
    assert.match(RUNTIME, /new\|another[\s\S]*questionnaire/);
  });
});
