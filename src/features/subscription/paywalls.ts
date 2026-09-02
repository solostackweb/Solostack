import "server-only";
import { EARLY_ACCESS_MODE } from "@/config/product-mode";

/**
 * Global paywall kill-switch.
 *
 * During open testing / pre-pricing-launch periods we want every gated
 * feature and usage limit to behave as if the caller is on the most
 * permissive plan. The architecture stays intact — flipping the flag
 * off restores enforcement instantly.
 *
 * Activated via the `STACKIVO_DISABLE_PAYWALLS` environment variable.
 * Truthy = on (paywalls disabled). Accepts `1`, `true`, `yes` (case
 * insensitive). Anything else = off.
 *
 * Three call sites consult this flag:
 *
 *   - `requireFeature(...)`     → returns the current sub without
 *                                 checking entitlements.
 *   - `requireWithinLimit(...)` → returns the usage snapshot without
 *                                 checking the cap.
 *   - `assertCanCreateClient()` → returns null (allow) regardless of
 *                                 the lifetime-clients counter.
 *
 * Per-call site behaviour is preserved otherwise — no separate code
 * path. We're intentionally NOT changing PLAN limits or rewriting
 * subscription state. The flag only changes the GATE result.
 */

let cached: boolean | null = null;

function readEnvFlag(): boolean {
  // Read at import time and cache. Server-only env vars don't change at
  // runtime in production, so re-reading per call would be wasted work.
  const raw = process.env.STACKIVO_DISABLE_PAYWALLS;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function paywallsDisabled(): boolean {
  if (EARLY_ACCESS_MODE) return true;
  if (cached === null) cached = readEnvFlag();
  return cached;
}

/** Test-only: reset the cache so unit tests can flip the env between cases. */
export function __resetPaywallsCacheForTest(): void {
  cached = null;
}
