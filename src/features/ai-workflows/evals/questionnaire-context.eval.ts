import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(process.cwd(), "src");
const CONVERSATIONS = readFileSync(path.join(ROOT, "features/ai-workflows/conversation-actions.ts"), "utf8");
const DOMAIN = readFileSync(path.join(ROOT, "features/ai-workflows/domain-operations.ts"), "utf8");
const RESPONSES = readFileSync(path.join(ROOT, "features/questionnaires/components/questionnaire-responses-view.tsx"), "utf8");

describe("Ivo questionnaire-response context", () => {
  it("attaches the exact response from its page without copying answers into the prompt", () => {
    assert.match(RESPONSES, /type: "questionnaire_response"/);
    assert.match(RESPONSES, /id: send\.id/);
    assert.match(RESPONSES, /Analyze with IVo/);
    assert.doesNotMatch(RESPONSES, /JSON\.stringify\(send\.responses\)/);
  });

  it("rereads only an owned completed response", () => {
    const branch = CONVERSATIONS.match(/if \(reference\.type === "questionnaire_response"\)[\s\S]*?\n    }\n    const \{ data \} = await supabase\.from\("welcome_documents"\)/)?.[0] ?? "";
    assert.match(branch, /\.from\("questionnaire_sends"\)/);
    assert.match(branch, /\.eq\("user_id", userId\)/);
    assert.match(branch, /\.eq\("status", "completed"\)/);
  });

  it("marks stored answers as untrusted model context through the shared resource envelope", () => {
    assert.match(CONVERSATIONS, /responses: JSON\.stringify\(responseSummary\)\.slice\(0, 6000\)/);
  });

  it("offers recent completed responses in the global resource picker without shipping answers", () => {
    const options = DOMAIN.match(/export async function listIvoPickerOptionsAction[\s\S]*?\n}\n/)?.[0] ?? "";
    assert.match(options, /\.from\("questionnaire_sends"\)/);
    assert.match(options, /\.eq\("status", "completed"\)/);
    assert.doesNotMatch(options, /\.select\([^\n]*responses/);
  });
});
