/**
 * Registers the eval resolver hook. Passed to Node via `--import`.
 * See `eval-resolve.mjs` for why the hook is needed.
 */
import { register } from "node:module";

register("./eval-resolve.mjs", import.meta.url);
