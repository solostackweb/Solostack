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

export async function resolve(specifier, context, nextResolve) {
  // `@/foo/bar` -> `<repo>/src/foo/bar`, matching tsconfig `paths`.
  if (specifier.startsWith("@/")) {
    const target = path.join(SRC, specifier.slice(2));
    const withExt = /\.[a-z]+$/.test(target) ? target : `${target}.ts`;
    return nextResolve(pathToFileURL(withExt).href, context);
  }

  // Extensionless relative import -> try the TypeScript file first, then fall
  // through so genuine resolution failures still report the original specifier.
  if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      try {
        return await nextResolve(`${specifier}/index.ts`, context);
      } catch {
        /* fall through to the unmodified specifier below */
      }
    }
  }

  return nextResolve(specifier, context);
}
