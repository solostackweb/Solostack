#!/usr/bin/env node

/**
 * Guardrail for SP3: no server-only env vars in Client Components.
 *
 * Next.js only exposes NEXT_PUBLIC_* values to the browser, but accidentally
 * referencing server env names from a "use client" file still creates brittle
 * code and can lead to unsafe workarounds. This script scans client modules for
 * process.env.<NAME> where NAME is not explicitly public.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const CLIENT_DIRECTIVE_RE = /^\s*["']use client["']\s*;?/m;
const ENV_RE = /process\.env\.([A-Z0-9_]+)/g;
const ALLOWED = new Set(["NODE_ENV"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, files);
      continue;
    }
    const ext = full.slice(full.lastIndexOf("."));
    if (EXTENSIONS.has(ext)) files.push(full);
  }
  return files;
}

const violations = [];

for (const file of walk(SRC)) {
  const source = readFileSync(file, "utf8");
  if (!CLIENT_DIRECTIVE_RE.test(source)) continue;

  for (const match of source.matchAll(ENV_RE)) {
    const name = match[1];
    if (name.startsWith("NEXT_PUBLIC_") || ALLOWED.has(name)) continue;
    violations.push(`${relative(ROOT, file)} uses process.env.${name}`);
  }
}

if (violations.length > 0) {
  console.error("Server-only environment variables referenced from client modules:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Client env audit passed.");
