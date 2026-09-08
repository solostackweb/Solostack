import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd());
const BUILDER = readFileSync(path.join(ROOT, "src/features/questionnaires/components/questionnaire-builder.tsx"), "utf8");
const FILL = readFileSync(path.join(ROOT, "src/features/questionnaires/components/questionnaire-fill-view.tsx"), "utf8");
const MIGRATION = readFileSync(path.join(ROOT, "supabase/migrations/0088_questionnaire_public_layout.sql"), "utf8");

describe("questionnaire public layouts", () => {
  it("keeps guided mode as the default and persists only supported layouts", () => {
    assert.match(MIGRATION, /default 'guided'/);
    assert.match(MIGRATION, /public_layout in \('guided', 'classic'\)/);
  });

  it("offers both presentation modes in questionnaire settings", () => {
    assert.match(BUILDER, /Public form layout/);
    assert.match(BUILDER, /One at a time/);
    assert.match(BUILDER, /One page/);
  });

  it("renders every question together only in classic mode", () => {
    assert.match(FILL, /send\.layout === "classic"/);
    assert.match(FILL, /function ClassicForm/);
    assert.match(FILL, /questions\.map/);
  });
});
