import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SECTION = readFileSync(
  path.resolve(process.cwd(), "src/components/marketing/section.tsx"),
  "utf8",
);

describe("marketing ruled-column icons", () => {
  it("instantiates forwardRef Lucide icons instead of rendering the component object", () => {
    assert.match(SECTION, /React\.createElement\(index,/);
    assert.doesNotMatch(SECTION, /typeof index === "function"/);
  });
});
