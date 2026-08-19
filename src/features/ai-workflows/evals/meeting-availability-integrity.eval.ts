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

test("Ivo routes an unconnected calendar to the one real recovery path", () => {
  assert.match(PANEL, /"availabilitySetup" in res && res\.availabilitySetup/);
  assert.match(PANEL, /router\.push\("\/dashboard\/meetings\/availability"\)/);
});

test("Ivo never offers scheduling without a connected calendar", () => {
  // Meetings are booked on Google Calendar and joined over Meet, so there is
  // no manual-times fallback to fall back to. Offering one sent people to a
  // page that produced a call which could never get a join link.
  assert.doesNotMatch(PANEL, /Choose specific times/);
  assert.doesNotMatch(PANEL, /dashboard\/meetings\/new\?\$\{manualParams/);
});

test("creating a meeting requires a connected calendar server-side", () => {
  // The pages gate too, but the action is the only thing a direct call, a
  // stale tab, or a future caller has to get past.
  const gate = MEETING_ACTIONS.indexOf("const calendar = await getCalendarConnection(userId)");
  const insertion = MEETING_ACTIONS.indexOf('.from("meetings")');
  assert.ok(gate >= 0 && gate < insertion);
  assert.match(
    MEETING_ACTIONS.slice(gate, insertion),
    /!isGoogleConfigured\(\) \|\| !calendar\.connected/,
  );
});
