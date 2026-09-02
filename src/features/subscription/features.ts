/**
 * Pure feature-gating utilities.
 *
 * Everything here is synchronous + side-effect free so the same helpers can
 * run on the server (in actions / route handlers) and in the client (to
 * conditionally render UI). Data access (reading the user's plan / usage)
 * is NOT done here — pass in a resolved `CurrentSubscription` from whoever
 * called you.
 */

import { getPlan } from "./plans";
import { EARLY_ACCESS_MODE } from "@/config/product-mode";
import type {
  CurrentSubscription,
  FeatureKey,
  ModuleKey,
  UsageMetric,
  UsageSnapshot,
} from "./types";

/**
 * Returns true when the user's current plan grants the given feature flag.
 * A `canceled` / `expired` subscription is treated as read-only — the user
 * keeps `free` entitlements only.
 */
export function hasFeature(
  sub: CurrentSubscription | null,
  feature: FeatureKey,
): boolean {
  if (EARLY_ACCESS_MODE) return true;
  const plan = getPlan(effectivePlan(sub));
  return plan.features[feature] === true;
}

/**
 * Returns true when the user can access the given module. Use in nav
 * builders and route guards.
 */
export function hasModule(
  sub: CurrentSubscription | null,
  module: ModuleKey,
): boolean {
  if (EARLY_ACCESS_MODE) return true;
  const plan = getPlan(effectivePlan(sub));
  return plan.modules.includes(module);
}

/**
 * The effective plan given the subscription status. Lapsed subscriptions
 * collapse to `free` so users can still log in and read their data.
 */
export function effectivePlan(sub: CurrentSubscription | null) {
  if (!sub) return "free" as const;
  if (sub.status === "canceled" || sub.status === "expired") {
    return "free" as const;
  }
  return sub.plan;
}

/** Monthly cap for a given metric on the user's current plan. */
export function limitFor(
  sub: CurrentSubscription | null,
  metric: UsageMetric,
): number {
  if (EARLY_ACCESS_MODE) return Infinity;
  const plan = getPlan(effectivePlan(sub));
  return plan.limits[metric];
}

/**
 * Turns raw counter + plan into a display-ready `UsageSnapshot`. Used by
 * the settings Billing page and any "3/5 invoices used" inline hints.
 */
export function toUsageSnapshot(args: {
  sub: CurrentSubscription | null;
  metric: UsageMetric;
  used: number;
  periodStart: string;
  periodEnd: string;
}): UsageSnapshot {
  const { sub, metric, used, periodStart, periodEnd } = args;
  const limit = limitFor(sub, metric);
  const unlimited = limit === Infinity;
  return {
    metric,
    used,
    limit,
    utilisation: unlimited ? 0 : Math.min(1, used / Math.max(1, limit)),
    exceeded: !unlimited && used >= limit,
    remaining: unlimited ? Infinity : Math.max(0, limit - used),
    periodStart,
    periodEnd,
  };
}

/**
 * Check whether creating `delta` more of `metric` would exceed the cap.
 * Call this BEFORE performing the mutation.
 */
export function withinLimit(
  sub: CurrentSubscription | null,
  metric: UsageMetric,
  currentUsed: number,
  delta = 1,
): boolean {
  const cap = limitFor(sub, metric);
  if (cap === Infinity) return true;
  return currentUsed + delta <= cap;
}
