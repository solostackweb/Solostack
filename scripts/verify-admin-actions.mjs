#!/usr/bin/env node
/**
 * Phase-4 invariant: every admin WRITE in
 * `src/features/admin/actions.ts` must flow through `runAdminAction()`
 * so it lands in `admin_actions`. Direct `.insert / .update / .delete
 * / .upsert` calls outside a runAdminAction body silently skip the
 * audit row.
 *
 * Enforcement strategy:
 *   1. Parse the file as plain text (regex — TypeScript AST parsers
 *      would be overkill).
 *   2. For each top-level `export async function adminXxx(...)`,
 *      slice the function body.
 *   3. Refuse if the body contains a write method call AND does not
 *      contain `runAdminAction(`.
 *
 * Exit codes:
 *   0 — every admin action is properly wrapped.
 *   1 — at least one violation; details printed to stderr.
 *
 * Wire this script via `npm run verify:admin-actions` and call it
 * from CI / pre-commit hooks. Locally it runs in < 50ms.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ACTIONS_PATHS = [
  resolve(__dirname, "..", "src", "features", "admin", "actions.ts"),
  resolve(__dirname, "..", "src", "features", "support", "ticket-actions.ts"),
];

/**
 * Match every `export async function adminXxx(` and find the matching
 * `}` to slice the body. Naive but reliable for this file's style.
 */
const EXPORT_RE = /export async function (admin\w+)\s*\(/g;
const WRITE_RE = /\.(insert|update|delete|upsert)\s*\(/;

const violations = [];

for (const actionsPath of ACTIONS_PATHS) {
  const source = readFileSync(actionsPath, "utf8");
  let match;
  while ((match = EXPORT_RE.exec(source)) !== null) {
    const fnName = match[1];
    const start = source.indexOf("{", EXPORT_RE.lastIndex);
    if (start === -1) continue;

    // Walk braces to find the matching close.
    let depth = 0;
    let end = -1;
    for (let i = start; i < source.length; i++) {
      const ch = source[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;

    const body = source.slice(start, end + 1);

    if (WRITE_RE.test(body) && !body.includes("runAdminAction(")) {
      violations.push(`${actionsPath.replace(resolve(__dirname, "..") + "\\", "")}:${fnName}`);
    }
  }
}

if (violations.length === 0) {
  console.log("verify-admin-actions: OK — every export uses runAdminAction().");
  process.exit(0);
} else {
  console.error("verify-admin-actions: FAILED");
  console.error(
    "The following exported admin actions perform writes (.insert / .update /",
  );
  console.error(
    ".delete / .upsert) but DO NOT wrap them in runAdminAction(). This means",
  );
  console.error("the write would skip the admin_actions audit trail.");
  console.error("");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.error("");
  console.error(
    "Wrap the write inside runAdminAction({ kind, targetType, targetId }, async () => { ... }).",
  );
  process.exit(1);
}
