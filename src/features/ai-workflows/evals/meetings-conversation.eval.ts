import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { meetingListFilter, planIvoRuntime } from "../runtime-planner";

const ROOT = path.join(process.cwd(), "src/features/ai-workflows");
const CONVERSATION = readFileSync(path.join(ROOT, "conversation-actions.ts"), "utf8");
const DOMAIN = readFileSync(path.join(ROOT, "domain-operations.ts"), "utf8");
const PANEL = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");

const interpretation = {
  intent: "general" as const,
  confident: false,
  fields: {},
  provider: "local" as const,
};

describe("meeting workspace requests", () => {
  it("recognises the exact request that previously fell through to help docs", () => {
    assert.equal(meetingListFilter("check my meetings"), "upcoming");
    assert.equal(meetingListFilter("show meetings awaiting confirmation"), "awaiting");
    assert.equal(meetingListFilter("show all past meetings"), "all");
    assert.equal(meetingListFilter("how do meetings work?"), null);
  });

  it("plans a canonical meeting list rather than support", () => {
    assert.deepEqual(planIvoRuntime({
      message: "check my meetings",
      interpretation,
      currentMode: "general",
      collected: {},
      clientId: "",
      projectId: "",
      requestId: "e3cf3822-75a5-4dda-a71c-ea6ba18e4937",
    }), { kind: "list", entityType: "meeting", filter: "upcoming" });
  });

  it("short-circuits before Groq and keeps reads owner-scoped", () => {
    const direct = CONVERSATION.indexOf("meetingListFilter(parsed.data.message)");
    const agent = CONVERSATION.indexOf("const agent = await runIvoAgent");
    assert.ok(direct >= 0 && direct < agent);
    const meetingRead = DOMAIN.slice(
      DOMAIN.indexOf("export async function listMeetingsForAiAction"),
      DOMAIN.indexOf("export async function", DOMAIN.indexOf("export async function listMeetingsForAiAction") + 30),
    );
    assert.match(meetingRead, /\.eq\("user_id", userId\)/);
    assert.match(CONVERSATION, /reference\.entityType === "meeting"/);
    assert.match(PANEL, /<MeetingListBlock/);
  });
});
