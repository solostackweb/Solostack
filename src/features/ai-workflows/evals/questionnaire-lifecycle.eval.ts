import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd());
const ACTIONS = readFileSync(path.join(ROOT, "src/features/questionnaires/actions.ts"), "utf8");
const FILL = readFileSync(path.join(ROOT, "src/features/questionnaires/components/questionnaire-fill-view.tsx"), "utf8");
const SHEETS = readFileSync(path.join(ROOT, "src/features/questionnaires/google-sheets.ts"), "utf8");
const MIGRATION = readFileSync(path.join(ROOT, "supabase/migrations/0089_questionnaire_lifecycle.sql"), "utf8");

describe("questionnaire lifecycle and branching", () => {
  it("revokes collection links without deleting response rows", () => {
    assert.match(ACTIONS, /revokeQuestionnaireLinkAction/);
    assert.match(ACTIONS, /revoked_at: new Date\(\)\.toISOString\(\)/);
    assert.doesNotMatch(ACTIONS, /from\("questionnaire_sends"\)\.delete/);
    assert.match(MIGRATION, /add column if not exists revoked_at/);
  });

  it("stops at a configured answer in both browser and server validation", () => {
    assert.match(FILL, /reachableQuestions/);
    assert.match(FILL, /question\.endFormOn === answers\[question\.id\]/);
    assert.match(ACTIONS, /question\.endFormOn === value\) break/);
  });

  it("stores only the reachable question snapshot", () => {
    assert.match(ACTIONS, /sanitized\.data\.questions/);
  });

  it("creates reusable owner-scoped templates", () => {
    assert.match(MIGRATION, /create table if not exists public\.questionnaire_templates/);
    assert.match(ACTIONS, /saveQuestionnaireAsTemplateAction/);
    assert.match(ACTIONS, /createFromSavedTemplateAction/);
  });

  it("formats response sheets with readable headers, wrapping, widths, and filters", () => {
    assert.match(SHEETS, /formatResponseSheet/);
    assert.match(SHEETS, /wrapStrategy: "WRAP"/);
    assert.match(SHEETS, /setBasicFilter/);
    assert.match(SHEETS, /pixelSize: 280/);
  });
});
