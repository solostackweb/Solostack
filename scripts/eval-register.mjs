/**
 * Bootstraps the Ivo eval run. Passed to Node via `--import` so this executes
 * before any application module is loaded.
 *
 * Two jobs:
 *
 *   1. Register the resolver hook (see `eval-resolve.mjs`).
 *   2. Supply the minimum environment `src/config/env.ts` validates at import
 *      time. These are placeholders — nothing here connects to anything. The
 *      evals under test are pure functions; the values exist only so importing
 *      a module that transitively touches `env` does not throw.
 *
 * Provider keys are deliberately NOT set. With no `GROQ_API_KEY`,
 * `generateStructuredJson` short-circuits without attempting a request, so a
 * default run exercises the deterministic fallback with no network and no cost.
 * Export a real `GROQ_API_KEY` before `npm run eval` to run the same cases
 * against the model.
 */
import { register } from "node:module";

const PLACEHOLDER_ENV = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eval-placeholder-anon-key",
};

for (const [key, value] of Object.entries(PLACEHOLDER_ENV)) {
  // Never clobber a real value the caller set on purpose.
  process.env[key] ??= value;
}

register("./eval-resolve.mjs", import.meta.url);
