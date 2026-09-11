import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd(), "src/features/questionnaires");
const ACTIONS = readFileSync(path.join(ROOT, "actions.ts"), "utf8");
const TYPES = readFileSync(path.join(ROOT, "types.ts"), "utf8");
const FILL = readFileSync(path.join(ROOT, "components/questionnaire-fill-view.tsx"), "utf8");
const SHARE_DIALOG = readFileSync(path.join(ROOT, "components/send-questionnaire-dialog.tsx"), "utf8");
const SHEETS = readFileSync(path.join(ROOT, "google-sheets.ts"), "utf8");
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

  it("creates a valid Sheets document with a frozen header row", () => {
    assert.match(SHEETS, /gridProperties:\s*\{\s*frozenRowCount:\s*1\s*\}/);
    assert.doesNotMatch(SHEETS, /title:\s*sheetTitle,\s*frozenRowCount/);
  });

  it("creates audience-neutral links without requiring a client", () => {
    assert.match(ACTIONS, /client_id:\s*null/);
    assert.match(ACTIONS, /project_id:\s*null/);
    assert.doesNotMatch(SHARE_DIALOG, /Choose a client/);
  });

  it("collects respondent identity only when the questionnaire requires it", () => {
    assert.match(ACTIONS, /respondentName:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(200\)\.optional\(\)/);
    assert.match(ACTIONS, /if \(collectRespondentIdentity && \(!parsed\.data\.respondentName/);
    assert.match(FILL, /send\.collectRespondentIdentity/);
    assert.match(FILL, /autoComplete="name"/);
    assert.match(FILL, /autoComplete="email"/);
  });

  it("keeps identity validation valid after the details screen unmounts", () => {
    assert.match(FILL, /emailInput && !emailInput\.checkValidity\(\)/);
    assert.doesNotMatch(FILL, /!emailInput\?\.checkValidity\(\)/);
  });

  it("shows the questionnaire introduction only before the guided questions", () => {
    assert.doesNotMatch(FILL, /step === 0 \? <div[\s\S]{0,250}\{send\.title\}/);
  });

  it("uses interaction-appropriate cursors on the public form", () => {
    assert.match(FILL, /min-h-screen cursor-default select-none/);
    assert.match(FILL, /inputCls = `\$\{controlCls\} cursor-text select-text`/);
    assert.match(FILL, /selectCls = `\$\{controlCls\} cursor-pointer select-none`/);
  });
});
