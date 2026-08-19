import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Guards the failure that silently cost us every welcome-document, portal, and
 * questionnaire delivery log.
 *
 * `delivery_logs.kind` and `.entity_type` carry CHECK constraints. The app grew
 * new kinds; the constraints didn't. Inserts failed, insertDeliveryLog()
 * returned null, and dispatchDelivery() sent the email anyway — so the emails
 * arrived while their audit rows, Brevo webhook join targets, and idempotency
 * guards quietly went missing.
 *
 * These tests fail the moment the TypeScript unions drift ahead of the SQL
 * again, which is the only way to notice before production does.
 */

const ROOT = process.cwd();
const MIGRATIONS = path.join(ROOT, "supabase/migrations");

const TYPES = readFileSync(path.join(ROOT, "src/lib/supabase/types.ts"), "utf8");
const SEND = readFileSync(path.join(ROOT, "src/features/email/send.ts"), "utf8");

/** Values allowed by the newest migration that redefines `constraint`. */
function allowedByLatestConstraint(constraint: string): Set<string> {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let allowed: Set<string> | null = null;
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    const idx = sql.lastIndexOf(constraint);
    if (idx === -1) continue;
    const open = sql.indexOf("(", sql.indexOf("check", idx));
    if (open === -1) continue;
    // Walk to the matching close paren so nested parens don't truncate it.
    let depth = 0;
    let close = -1;
    for (let i = open; i < sql.length; i += 1) {
      if (sql[i] === "(") depth += 1;
      else if (sql[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) continue;
    const body = sql.slice(open + 1, close);
    const values = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    if (values.length) allowed = new Set(values);
  }

  assert.ok(allowed, `no migration defines ${constraint}`);
  return allowed as Set<string>;
}

/** Members of a TypeScript string-literal union declaration. */
function unionMembers(source: string, name: string): string[] {
  const start = source.indexOf(`export type ${name} =`);
  assert.ok(start >= 0, `${name} not found`);
  const end = source.indexOf(";", start);
  return [...source.slice(start, end).matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

test("every DeliveryKind is permitted by the delivery_logs kind constraint", () => {
  const kinds = unionMembers(TYPES, "DeliveryKind");
  assert.ok(kinds.length > 5);
  const allowed = allowedByLatestConstraint("delivery_logs_kind_check");
  const missing = kinds.filter((k) => !allowed.has(k));
  assert.deepEqual(
    missing,
    [],
    `DeliveryKind values rejected by the DB constraint: ${missing.join(", ")}`,
  );
});

test("every dispatchDelivery entityType is permitted by the constraint", () => {
  // The union is declared inline on DeliveryDispatchInput rather than exported.
  const start = SEND.indexOf("entityType:");
  assert.ok(start >= 0);
  const end = SEND.indexOf(";", start);
  const types = [...SEND.slice(start, end).matchAll(/"([a-z_]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(types.length > 3);

  const allowed = allowedByLatestConstraint("delivery_logs_entity_type_check");
  const missing = types.filter((t) => !allowed.has(t));
  assert.deepEqual(
    missing,
    [],
    `entityType values rejected by the DB constraint: ${missing.join(", ")}`,
  );
});

test("a delivery that cannot be logged is not sent when idempotency was requested", () => {
  // Losing the row loses the guard, so the next retry would duplicate.
  const gate = SEND.indexOf("if (input.idempotencyKey && !logId)");
  const send = SEND.indexOf("await sendEmail({");
  assert.ok(gate >= 0, "missing fail-closed guard for unlogged deliveries");
  assert.ok(gate < send, "the guard must precede the send");
});

test("a failed delivery-log insert is reported, never swallowed", () => {
  assert.match(SEND, /log\.error\("email\.delivery_log\.insert_failed"/);
});
