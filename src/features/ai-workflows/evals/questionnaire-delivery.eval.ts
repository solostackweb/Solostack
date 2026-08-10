import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(ROOT, relativePath), "utf8");

const MIGRATION = read("supabase/migrations/0076_questionnaire_send_idempotency.sql");
const QUESTIONNAIRE_ACTIONS = read("src/features/questionnaires/actions.ts");
const TOOL_ACTIONS = read("src/features/ai-workflows/tool-actions.ts");
const DOMAIN = read("src/features/ai-workflows/domain-operations.ts");
const PREVIEWS = read("src/features/ai-workflows/components/assistant-previews.tsx");
const ASSISTANT = read("src/features/ai-workflows/components/stackivo-ai-assistant.tsx");
const DIALOG = read("src/features/questionnaires/components/send-questionnaire-dialog.tsx");
const SEND_VIEW = read("src/features/questionnaires/components/questionnaire-send-view.tsx");

describe("questionnaire delivery", () => {
  it("deduplicates questionnaire links at the database boundary", () => {
    assert.match(MIGRATION, /add column if not exists idempotency_key text/i);
    assert.match(MIGRATION, /unique index[\s\S]*user_id, idempotency_key/i);
    assert.match(QUESTIONNAIRE_ACTIONS, /\.eq\("idempotency_key", parsed\.data\.idempotencyKey\)/);
    assert.match(QUESTIONNAIRE_ACTIONS, /error\?\.code === "23505"/);
  });

  it("rechecks ownership and project-client consistency before creating a link", () => {
    const sender = QUESTIONNAIRE_ACTIONS.match(
      /export async function sendQuestionnaireAction[\s\S]*?export async function submitQuestionnaireAction/,
    )?.[0] ?? "";
    assert.match(sender, /\.from\("questionnaires"\)[\s\S]*?\.eq\("user_id", userId\)/);
    assert.match(sender, /\.from\("clients"\)[\s\S]*?\.eq\("user_id", userId\)/);
    assert.match(sender, /\.from\("projects"\)[\s\S]*?\.eq\("user_id", userId\)/);
    assert.match(sender, /project\.client_id !== parsed\.data\.clientId/);
  });

  it("routes email through the canonical delivery log with a scoped idempotency key", () => {
    assert.match(QUESTIONNAIRE_ACTIONS, /dispatchDelivery\(\{/);
    assert.match(QUESTIONNAIRE_ACTIONS, /kind: "questionnaire_sent"/);
    assert.match(QUESTIONNAIRE_ACTIONS, /entityType: "questionnaire"/);
    assert.match(
      QUESTIONNAIRE_ACTIONS,
      /`questionnaire-email:\$\{args\.userId\}:\$\{args\.idempotencyKey\}`/,
    );
  });

  it("binds the approved IVo attempt to both questionnaire and project", () => {
    assert.match(TOOL_ACTIONS, /runApprovedEmailTool\([\s\S]*?"questionnaire\.send"/);
    assert.match(TOOL_ACTIONS, /entityId: input\.questionnaireId/);
    assert.match(TOOL_ACTIONS, /contextId: projectId\.data/);
    assert.match(DOMAIN, /idempotencyKey: `ivo:\$\{parsed\.data\.requestId\}`/);
  });

  it("requires a visible, explicit send choice from the project card", () => {
    assert.match(PREVIEWS, /onQuestionnaire\(r\.id\)/);
    assert.match(PREVIEWS, /> Questionnaire/);
    assert.match(PREVIEWS, /onSend\(row\.id, row\.title\)/);
    assert.match(PREVIEWS, /> Send to \{clientName\}/);
    assert.match(ASSISTANT, /listQuestionnairesForProjectAiAction\(\{ projectId \}\)/);
  });

  it("also gives the ordinary questionnaire UI a stable request key", () => {
    for (const source of [DIALOG, SEND_VIEW]) {
      assert.match(source, /requestKeyRef/);
      assert.match(source, /crypto\.randomUUID\(\)/);
      assert.match(source, /idempotencyKey: requestKeyRef\.current/);
    }
  });
});
