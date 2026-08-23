import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const AGENT = readFileSync(new URL("../agent.ts", import.meta.url), "utf8");
const PROMPT = readFileSync(new URL("../agent-prompt.ts", import.meta.url), "utf8");
const TIME_PAGE = readFileSync(
  new URL("../../time/components/time-dashboard-view.tsx", import.meta.url),
  "utf8",
);
const BUSINESS_CONTEXT = readFileSync(new URL("../business-context.ts", import.meta.url), "utf8");

test("the Time-page Ask Ivo action requests analysis without creating a draft", () => {
  assert.match(TIME_PAGE, /Review my unbilled time by client and project/);
  assert.match(TIME_PAGE, /don't create an invoice yet/);
  assert.match(TIME_PAGE, /Create an invoice for my unbilled time/);
});

test("the Groq agent withholds the mutation tool for unbilled-time questions", () => {
  assert.match(AGENT, /!isUnbilledTimeInvoiceAction\(input\.message\)/);
  assert.match(AGENT, /tool\.function\.name === "invoice_unbilled_time"/);
  assert.match(PROMPT, /Treat 'What unbilled time should I invoice\?'.*READ-ONLY analysis/);
});

test("the business snapshot gives IVo invoice-ready client and project evidence", () => {
  assert.match(BUSINESS_CONTEXT, /client: group\.client/);
  assert.match(BUSINESS_CONTEXT, /effectiveRate:/);
  assert.match(BUSINESS_CONTEXT, /earliest: group\.earliest/);
  assert.match(BUSINESS_CONTEXT, /latest: group\.latest/);
  assert.match(BUSINESS_CONTEXT, /No client assigned/);
});
