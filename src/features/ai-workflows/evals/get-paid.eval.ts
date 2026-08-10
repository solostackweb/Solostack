import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src/features/ai-workflows");
const ASSISTANT = readFileSync(path.join(ROOT, "components/stackivo-ai-assistant.tsx"), "utf8");
const PREVIEWS = readFileSync(path.join(ROOT, "components/assistant-previews.tsx"), "utf8");
const TOOLS = readFileSync(path.join(ROOT, "tool-actions.ts"), "utf8");
const DOMAIN = readFileSync(path.join(ROOT, "domain-operations.ts"), "utf8");

describe("Ivo get-paid journey", () => {
  it("routes a row reminder through the reminder tool, never ordinary invoice delivery", () => {
    const handler = ASSISTANT.match(
      /const handleRowRemind[\s\S]*?const runListInvoices/,
    )?.[0] ?? "";
    assert.match(handler, /tools\.remindInvoice\(id\)/);
    assert.doesNotMatch(handler, /tools\.emailInvoice\(id\)/);
  });

  it("labels the irreversible client action explicitly", () => {
    assert.match(PREVIEWS, /> Send reminder/);
  });

  it("uses a dedicated audited tool and the canonical reminder operation", () => {
    assert.match(TOOLS, /"invoice\.remind_one"/);
    assert.match(TOOLS, /remindInvoiceFromAiAction\(\{ invoiceId \}\)/);
  });

  it("deduplicates manual and automated reminders and includes partial balances", () => {
    assert.match(DOMAIN, /invoice-reminder:\$\{inv\.id\}:d\$\{daysOverdue\}/);
    assert.match(DOMAIN, /\["sent", "viewed", "overdue", "partially_paid"\]/);
    assert.match(DOMAIN, /amountFormatted: formatMoneyPlain\(balance, inv\.currency\)/);
  });
});
