import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSystemPrompt, IVO_INDEX_LIMIT } from "../agent-prompt";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";

/**
 * The system prompt is re-sent on every agent round, so its size is paid
 * MAX_ROUNDS times per message. These cases pin the budget so prompt growth
 * (new instructions, bigger indexes) is a deliberate, reviewed act rather than
 * silent drift. Char counts are the proxy for tokens (~4 chars/token).
 */

function makeClient(index: number): ClientRecord {
  return {
    id: `c${index.toString().padStart(36, "0")}`,
    fullName: `Client Number ${index}`,
    businessName: null,
    isForeign: false,
    currency: "INR",
  } as unknown as ClientRecord;
}

function makeProject(index: number): ProjectRecord {
  return {
    id: `p${index.toString().padStart(36, "0")}`,
    name: `Project Number ${index}`,
  } as unknown as ProjectRecord;
}

const BASE_INPUT = {
  message: "test",
  history: [],
  userId: "user",
  firstName: null,
  currentMode: "general" as const,
  collected: {},
  clientId: undefined,
  projectId: undefined,
  pendingField: undefined,
  activeDraft: undefined,
  page: undefined,
  resources: [],
  requestId: "00000000-0000-4000-8000-000000000000",
};

function build(clients: ClientRecord[], projects: ProjectRecord[]): string {
  return buildSystemPrompt(
    { ...BASE_INPUT, clients, projects },
    [],
  );
}

describe("system prompt size budget", () => {
  it("stays small for an empty workspace", () => {
    const prompt = build([], []);
    // Measured baseline: the standing instruction block alone is ~6.1KB.
    assert.ok(prompt.length < 6500, `empty-workspace prompt was ${prompt.length} chars`);
  });

  it("indexes are capped at IVO_INDEX_LIMIT entries", () => {
    const prompt = build(
      Array.from({ length: IVO_INDEX_LIMIT + 25 }, (_, i) => makeClient(i)),
      Array.from({ length: IVO_INDEX_LIMIT }, (_, i) => makeProject(i)),
    );
    assert.equal((prompt.match(/c\d{36}/g) ?? []).length, IVO_INDEX_LIMIT);
    assert.equal((prompt.match(/p\d{36}/g) ?? []).length, IVO_INDEX_LIMIT);
  });

  it("a clipped index tells the model it is clipped", () => {
    const prompt = build(
      Array.from({ length: IVO_INDEX_LIMIT + 1 }, (_, i) => makeClient(i)),
      [],
    );
    assert.match(prompt, /client index shows the first \d+ of \d+/);
    assert.doesNotMatch(build([], []), /INDEX LIMITS:/);
  });

  it("full-scale workspace stays under the round budget", () => {
    const prompt = build(
      Array.from({ length: IVO_INDEX_LIMIT }, (_, i) => makeClient(i)),
      Array.from({ length: IVO_INDEX_LIMIT }, (_, i) => makeProject(i)),
    );
    // Ceiling for the whole prompt at maximum index size. Raise only with a
    // measured reason: this cost multiplies by MAX_ROUNDS per user message.
    assert.ok(prompt.length < 20000, `full-scale prompt was ${prompt.length} chars`);
  });
});
