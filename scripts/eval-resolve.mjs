/**
 * Module resolver hook for the Ivo eval suite.
 *
 * The app compiles under TypeScript's `bundler` module resolution, which lets
 * internal imports omit the file extension (`./types`). Node's ESM loader
 * requires it. Rather than add a TypeScript runner to a repository that has
 * deliberately kept its devDependencies small, this hook appends `.ts` when a
 * relative specifier has no extension, and maps the `@/` alias to `src/`.
 *
 * Paired with `node --experimental-strip-types`, this runs the real modules
 * with no build step and no new packages. Run via `npm run eval`.
 */

import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const SRC = path.resolve(fileURLToPath(new URL("../src", import.meta.url)));

/** The forms an extensionless specifier may take, in TypeScript's own order. */
const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];

async function tryCandidates(base, context, nextResolve) {
  for (const suffix of CANDIDATE_SUFFIXES) {
    try {
      return await nextResolve(`${base}${suffix}`, context);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const hasExtension = /\.[a-z]+$/.test(specifier);

  // `@/foo/bar` -> `<repo>/src/foo/bar`, matching tsconfig `paths`.
  if (specifier.startsWith("@/")) {
    const target = pathToFileURL(path.join(SRC, specifier.slice(2))).href;
    if (hasExtension) return nextResolve(target, context);
    const resolved = await tryCandidates(target, context, nextResolve);
    if (resolved) return resolved;
    // Fall through so the failure names the alias the author actually wrote.
    return nextResolve(target, context);
  }

  // Extensionless relative import -> try the TypeScript forms, then fall
  // through so genuine resolution failures report the original specifier.
  if (specifier.startsWith(".") && !hasExtension) {
    const resolved = await tryCandidates(specifier, context, nextResolve);
    if (resolved) return resolved;
  }

  return nextResolve(specifier, context);
}
