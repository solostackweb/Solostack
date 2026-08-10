import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

import {
  formatAssistantMessageContent,
  hasStructuredAssistantFormatting,
  parseAssistantRichText,
} from "../assistant-text";
import { isQuestionnaireCreationRequest, planIvoRuntime } from "../runtime-planner";

const CONVERSATION = readFileSync(
  path.join(process.cwd(), "src/features/ai-workflows/conversation-actions.ts"),
  "utf8",
);

const interpretation = {
  intent: "general" as const,
  confident: false,
  fields: {},
  provider: "local" as const,
};

describe("questionnaire conversation entry", () => {
  it("recognises the exact request that previously produced generic advice", () => {
    assert.equal(isQuestionnaireCreationRequest("help me prepare a questionnaire"), true);
  });

  it("does not hijack a knowledge question about questionnaires", () => {
    assert.equal(isQuestionnaireCreationRequest("what is a client questionnaire?"), false);
  });

  it("routes creation to the workspace flow instead of a plain reply", () => {
    const decision = planIvoRuntime({
      message: "help me prepare a questionnaire",
      interpretation,
      currentMode: "general",
      collected: {},
      clientId: "",
      projectId: "",
      requestId: "3c57d7f6-40d4-4fd1-8f7f-61a09a13a323",
    });
    assert.deepEqual(decision, { kind: "questionnaire" });
  });

  it("short-circuits before the model agent for deterministic routing", () => {
    const direct = CONVERSATION.indexOf("isQuestionnaireCreationRequest(parsed.data.message)");
    const agent = CONVERSATION.indexOf("const agent = await runIvoAgent");
    assert.ok(direct >= 0 && direct < agent);
  });
});

describe("plain assistant text", () => {
  it("removes raw HTML, markdown emphasis, and table separators", () => {
    const formatted = formatAssistantMessageContent(
      "| **Section** | Goal |<br>|---|---|<br>| **Scope** | Define work |",
    );
    assert.equal(formatted, "Section — Goal\nScope — Define work");
    assert.doesNotMatch(formatted, /<br|\*\*|\|---|<[^>]+>/i);
  });

  it("turns a workspace review table and priorities into structured UI blocks", () => {
    const source = [
      "Here's what needs attention:",
      "",
      "| Project | Client | Status | What needs attention |",
      "|---|---|---|---|",
      "| **Portal Creation** | Kumar Associates | contract_sent | Follow up on signature. |",
      "",
      "**Top priorities right now**",
      "1. **Portal Creation** — send a follow-up today.",
    ].join("\n");

    assert.equal(hasStructuredAssistantFormatting(source), true);
    assert.deepEqual(parseAssistantRichText(source), [
      { kind: "paragraph", text: "Here's what needs attention:" },
      {
        kind: "table",
        headers: ["Project", "Client", "Status", "What needs attention"],
        rows: [["**Portal Creation**", "Kumar Associates", "contract_sent", "Follow up on signature."]],
      },
      { kind: "heading", text: "Top priorities right now" },
      { kind: "ordered", items: ["**Portal Creation** — send a follow-up today."] },
    ]);
  });
});
