import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const PROFILE_PAGE = readFileSync(
  path.join(ROOT, "src/app/(dashboard)/dashboard/settings/profile/page.tsx"),
  "utf8",
);
const PROFILE_ACTIONS = readFileSync(
  path.join(ROOT, "src/features/profile/actions.ts"),
  "utf8",
);
const PUBLIC_PROFILE_SERVER = readFileSync(
  path.join(ROOT, "src/features/profile/public-profile-server.ts"),
  "utf8",
);
const ADMIN_SUPABASE = readFileSync(
  path.join(ROOT, "src/lib/supabase/admin.ts"),
  "utf8",
);

test("service-role modules retain their server-only build guard", () => {
  assert.match(PUBLIC_PROFILE_SERVER, /import ["']server-only["'];/);
  assert.match(ADMIN_SUPABASE, /import ["']server-only["'];/);
});

test("the client profile page reaches reputation stats through a Server Action", () => {
  assert.match(PROFILE_PAGE, /^"use client";/);
  assert.doesNotMatch(PROFILE_PAGE, /from ["']@\/features\/profile\/public-profile-server["']/);
  assert.match(PROFILE_PAGE, /getCurrentPublicProfileStats/);

  assert.match(PROFILE_ACTIONS, /^"use server";/);
  const action = PROFILE_ACTIONS.indexOf(
    "export async function getCurrentPublicProfileStats",
  );
  assert.ok(action >= 0, "missing authenticated reputation-stats Server Action");
  const nextExport = PROFILE_ACTIONS.indexOf("\nexport ", action + 1);
  const body = PROFILE_ACTIONS.slice(
    action,
    nextExport === -1 ? PROFILE_ACTIONS.length : nextExport,
  );
  assert.match(body, /await requireUserId\(\)/);
  assert.match(body, /getPublicProfileStats\(userId\)/);
});
