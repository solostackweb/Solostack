import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pagePromptsForPath } from "../components/panel/page-prompts";

/**
 * Page-aware opening prompts must stay deterministic: the same section always
 * offers the same taps, unknown paths offer none, and nothing here may depend
 * on data or a model call.
 */
describe("page-aware opening prompts", () => {
  it("maps each covered workspace section to stable prompts", () => {
    assert.deepEqual(pagePromptsForPath("/dashboard/invoices"), [
      "Show my unpaid invoices",
      "How much am I owed right now?",
      "Send payment reminders for overdue invoices",
    ]);
    assert.deepEqual(pagePromptsForPath("/dashboard/clients"), [
      "Show my clients",
      "Which clients should get a portal next?",
      "Help me add my first client.",
    ]);
    assert.deepEqual(pagePromptsForPath("/dashboard/meetings"), [
      "What meetings do I have coming up?",
      "Which meetings are awaiting a time pick?",
    ]);
  });

  it("matches nested routes of a covered section", () => {
    assert.ok(pagePromptsForPath("/dashboard/invoices/abc-123").length > 0);
    assert.ok(pagePromptsForPath("/dashboard/time").length > 0);
  });

  it("offers nothing for uncovered or unknown paths", () => {
    assert.deepEqual(pagePromptsForPath("/dashboard/pulse"), []);
    assert.deepEqual(pagePromptsForPath("/dashboard/settings/profile"), []);
    assert.deepEqual(pagePromptsForPath("/login"), []);
    assert.deepEqual(pagePromptsForPath(""), []);
    assert.deepEqual(pagePromptsForPath(null), []);
    assert.deepEqual(pagePromptsForPath(undefined), []);
  });

  it("never returns more than three prompts for one page", () => {
    for (const path of [
      "/dashboard/invoices",
      "/dashboard/clients",
      "/dashboard/projects",
      "/dashboard/contracts",
      "/dashboard/proposals",
      "/dashboard/meetings",
      "/dashboard/time",
      "/dashboard/welcome",
    ]) {
      assert.ok(
        pagePromptsForPath(path).length <= 3,
        `${path} offered too many prompts`,
      );
    }
  });
});
