import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = path.join(process.cwd(), "src/features/ai-workflows/components");
const PREVIEWS = readFileSync(path.join(ROOT, "assistant-previews.tsx"), "utf8");
const PANEL = readFileSync(path.join(ROOT, "stackivo-ai-assistant.tsx"), "utf8");

test("document cards visually distinguish draft, live, completed, and attention states", () => {
  assert.match(PREVIEWS, /label: "Draft · Not sent"/);
  assert.match(PREVIEWS, /label: normalized === "viewed" \? "Live · Viewed" : "Live · Sent"/);
  assert.match(PREVIEWS, /border-l-emerald-500/);
  assert.match(PREVIEWS, /"signed", "accepted", "paid", "converted"/);
  assert.match(PREVIEWS, /border-l-destructive/);
  assert.match(PREVIEWS, /border-l-amber-500/);
  assert.equal(PREVIEWS.match(/<DocumentStatusBadge status=/g)?.length, 3);
});

test("all three document families use Send for drafts and Resend after delivery", () => {
  assert.match(PREVIEWS, /draft \? "Send invoice" : "Resend invoice"/);
  assert.match(PREVIEWS, /r\.status === "draft" \? "Send" : "Resend"/);
  assert.match(PREVIEWS, /row\.status === "draft" \? "Send proposal" : "Resend proposal"/);
});

test("invoice delivery is available on fresh and restored lists without reminding drafts", () => {
  assert.equal(PANEL.match(/onSend=\{handleRowSend\}/g)?.length, 2);
  assert.match(PANEL, /const handleRowSend = React\.useCallback[\s\S]*?tools\.emailInvoice\(id\)/);
  assert.match(PREVIEWS, /!paid && !draft && r\.status !== "cancelled"/);
});
