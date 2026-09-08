import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd());
const SERVER = readFileSync(path.join(ROOT, "src/features/questionnaires/server.ts"), "utf8");
const PAGE = readFileSync(path.join(ROOT, "src/app/(dashboard)/dashboard/questionnaires/[id]/responses/page.tsx"), "utf8");
const VIEW = readFileSync(path.join(ROOT, "src/features/questionnaires/components/questionnaire-responses-view.tsx"), "utf8");
const MIGRATION = readFileSync(path.join(ROOT, "supabase/migrations/0090_questionnaire_response_directory.sql"), "utf8");

describe("scalable questionnaire response directory", () => {
  it("paginates at the database boundary instead of loading every response", () => {
    assert.match(SERVER, /pageSize \?\? 25/);
    assert.match(SERVER, /\.range\(from, from \+ pageSize - 1\)/);
    assert.match(SERVER, /count: "exact"/);
    assert.match(PAGE, /searchParams: Promise/);
  });

  it("supports indexed respondent name and email search", () => {
    assert.match(MIGRATION, /generated always as \(responses ->> '__respondent_name'\) stored/);
    assert.match(MIGRATION, /questionnaire_responses_email_search_idx/);
    assert.match(SERVER, /respondent_name\.ilike/);
    assert.match(SERVER, /respondent_email\.ilike/);
  });

  it("uses a compact table with controlled expansion and pagination", () => {
    assert.match(VIEW, /function ResponseDirectory/);
    assert.match(VIEW, /min-w-\[760px\]/);
    assert.match(VIEW, /expandedId/);
    assert.match(VIEW, /Showing \{start\}–\{end\} of/);
  });
});
