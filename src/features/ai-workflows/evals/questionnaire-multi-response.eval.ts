import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd(), "src/features/questionnaires");
const ACTIONS = readFileSync(path.join(ROOT, "actions.ts"), "utf8");
const TYPES = readFileSync(path.join(ROOT, "types.ts"), "utf8");
const FILL = readFileSync(path.join(ROOT, "components/questionnaire-fill-view.tsx"), "utf8");
const MIGRATION = readFileSync(path.resolve(process.cwd(), "supabase/migrations/0087_questionnaire_response_collections.sql"), "utf8");

describe("questionnaire response collections", () => {
  it("stores each submission in the append-only response table", () => {
    assert.match(ACTIONS, /\.from\("questionnaire_responses"\)[\s\S]*?\.insert\(/);
    assert.doesNotMatch(ACTIONS, /This form was already submitted/);
    assert.match(MIGRATION, /unique \(send_id, submission_key\)/);
  });

  it("preserves configured Other and conditional follow-up answers", () => {
    assert.match(TYPES, /allowOther\?: boolean/);
    assert.match(TYPES, /conditionalFollowUp\?:/);
    assert.match(FILL, /otherAnswerKey\(question\.id\)/);
    assert.match(FILL, /followUpAnswerKey\(question\.id\)/);
  });

  it("allows another response after a successful submission", () => {
    assert.match(FILL, /Submit another response/);
    assert.match(FILL, /setSubmissionKey\(newSubmissionKey\(\)\)/);
  });

  it("keeps Google Sheets downstream of durable database capture", () => {
    const insertAt = ACTIONS.indexOf('.from("questionnaire_responses")');
    const syncAt = ACTIONS.indexOf("await syncQuestionnaireResponse");
    assert.ok(insertAt >= 0 && syncAt > insertAt);
  });
});
