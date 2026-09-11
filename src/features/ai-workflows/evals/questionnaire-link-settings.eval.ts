import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd());
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");
const ACTIONS = read("src/features/questionnaires/actions.ts");
const BUILDER = read("src/features/questionnaires/components/questionnaire-builder.tsx");
const DIALOG = read("src/features/questionnaires/components/send-questionnaire-dialog.tsx");
const RESPONSES = read("src/features/questionnaires/components/questionnaire-responses-view.tsx");
const FILL = read("src/features/questionnaires/components/questionnaire-fill-view.tsx");
const MIGRATION = read("supabase/migrations/0095_questionnaire_link_identity_settings.sql");

describe("questionnaire link and identity settings", () => {
  it("stores a validated owner-facing name for collection links", () => {
    assert.match(MIGRATION, /link_name text not null default 'Public collection link'/);
    assert.match(ACTIONS, /linkName: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(120\)/);
    assert.match(DIALOG, /Link name/);
    assert.match(RESPONSES, /renameQuestionnaireLinkAction/);
  });

  it("defaults identity collection on and exposes it in create and edit", () => {
    assert.match(MIGRATION, /collect_respondent_identity boolean not null default true/g);
    assert.match(BUILDER, /Collect respondent name and email/);
    assert.match(BUILDER, /initial\?\.collectRespondentIdentity \?\? true/);
    assert.match(ACTIONS, /collect_respondent_identity: parsed\.data\.collectRespondentIdentity \?\? true/);
  });

  it("removes identity UI and validation when collection is disabled", () => {
    assert.match(FILL, /if \(!send\.collectRespondentIdentity\) return true/);
    assert.match(FILL, /send\.collectRespondentIdentity && !detailsComplete/);
    assert.match(ACTIONS, /const respondentQuestions: Question\[\] = collectRespondentIdentity \?/);
  });
});
