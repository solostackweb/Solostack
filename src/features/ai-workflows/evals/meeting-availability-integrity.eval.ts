import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const MEETING_ACTIONS = readFileSync(
  path.join(ROOT, "src/features/meetings/actions.ts"),
  "utf8",
);
const DOMAIN = readFileSync(
  path.join(ROOT, "src/features/ai-workflows/domain-operations.ts"),
  "utf8",
);
const PANEL = readFileSync(
  path.join(ROOT, "src/features/ai-workflows/components/stackivo-ai-assistant.tsx"),
  "utf8",
);

test("availability meetings cannot be inserted when their booking page has no slots", () => {
  const readinessCheck = MEETING_ACTIONS.indexOf('if (mode === "availability")');
  const insertion = MEETING_ACTIONS.indexOf('.from("meetings")');
  assert.ok(readinessCheck >= 0 && readinessCheck < insertion);
  assert.match(
    MEETING_ACTIONS.slice(readinessCheck, insertion),
    /computeOpenSlots\(userId,[\s\S]*?openSlots\.length === 0[\s\S]*?No bookable times/,
  );
});

test("Ivo checks calendar readiness and real open times before requesting approval", () => {
  const connectionCheck = DOMAIN.indexOf("const calendar = await getCalendarConnection(userId)");
  const confirmation = DOMAIN.indexOf("if (!parsed.data.confirm)", connectionCheck);
  assert.ok(connectionCheck >= 0 && connectionCheck < confirmation);
  assert.match(
    DOMAIN.slice(connectionCheck, confirmation),
    /!isGoogleConfigured\(\) \|\| !calendar\.connected[\s\S]*?availabilitySetup: true/,
  );
  assert.match(
    DOMAIN.slice(connectionCheck, confirmation),
    /computeOpenSlots\(userId, \{ durationMinutes \}\)[\s\S]*?openSlots\.length === 0/,
  );
});

test("Ivo offers recovery paths instead of a dead booking link", () => {
  assert.match(PANEL, /"availabilitySetup" in res && res\.availabilitySetup/);
  assert.match(PANEL, /router\.push\("\/dashboard\/meetings\/availability"\)/);
  assert.match(PANEL, /Choose specific times/);
  assert.match(PANEL, /dashboard\/meetings\/new\?\$\{manualParams\.toString\(\)\}/);
});
