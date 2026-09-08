import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd());
const SERVER = readFileSync(path.join(ROOT, "src/features/lead-forms/server.ts"), "utf8");
const ACTIONS = readFileSync(path.join(ROOT, "src/features/lead-forms/actions.ts"), "utf8");
const DIRECTORY = readFileSync(path.join(ROOT, "src/features/lead-forms/components/lead-forms-view.tsx"), "utf8");
const PUBLIC_FORM = readFileSync(path.join(ROOT, "src/features/lead-forms/components/public-lead-form-view.tsx"), "utf8");
const SHEETS = readFileSync(path.join(ROOT, "src/features/questionnaires/google-sheets.ts"), "utf8");
const SHEETS_VIEW = readFileSync(path.join(ROOT, "src/features/questionnaires/components/questionnaire-responses-view.tsx"), "utf8");
const LOGOS = readFileSync(path.join(ROOT, "src/components/integrations/integration-logo.tsx"), "utf8");

describe("professional lead forms", () => {
  it("paginates and searches captured leads at the database boundary", () => {
    assert.match(SERVER, /count: "exact"/);
    assert.match(SERVER, /\.range\(from, from \+ pageSize - 1\)/);
    assert.match(SERVER, /name\.ilike/);
    assert.match(DIRECTORY, /function SubmissionDirectory/);
    assert.match(DIRECTORY, /Showing \{start\}–\{end\} of/);
  });

  it("supports a review lifecycle and safe response deletion", () => {
    assert.match(ACTIONS, /updateLeadSubmissionStatusAction/);
    assert.match(ACTIONS, /deleteLeadSubmissionAction/);
    assert.match(DIRECTORY, /The client and project records will be kept/);
  });

  it("renders a focused, private public intake experience", () => {
    assert.match(PUBLIC_FORM, /max-w-3xl/);
    assert.match(PUBLIC_FORM, /cursor-default select-none/);
    assert.match(PUBLIC_FORM, /Powered by Stackivo · Your details are shared privately/);
    assert.doesNotMatch(PUBLIC_FORM, /Move into proposal or discovery/);
  });
});

describe("one-time Google Sheets authorization", () => {
  it("uses the official Sheets provider mark", () => {
    assert.match(LOGOS, /google_sheets: \{ slug: "googlesheets"/);
    assert.match(SHEETS_VIEW, /IntegrationLogoTile id="google_sheets"/);
  });

  it("automatically creates a questionnaire sheet after authorization", () => {
    assert.match(SHEETS, /if \(!integration\) \{/);
    assert.match(SHEETS, /createQuestionnaireSpreadsheet\(/);
    assert.doesNotMatch(SHEETS_VIEW, />Connect Google Sheets</);
    assert.match(SHEETS_VIEW, /\/dashboard\/settings\/integrations/);
  });
});
