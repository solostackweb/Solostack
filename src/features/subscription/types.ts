/**
 * Subscription-system type contracts.
 *
 * `PlanId`, `FeatureKey`, `UsageMetric`, and `ModuleKey` are the four
 * primitives the rest of the system speaks in. All are string literal
 * unions so TypeScript catches typos everywhere they are referenced.
 *
 * Source of truth for the values themselves: `./plans.ts`.
 */

import type {
  SubscriptionPlanRow,
  SubscriptionStatusRow,
} from "@/lib/supabase/types";

// --- Plans ------------------------------------------------------------------

/** Matches the `plan` column in `public.subscriptions`. */
export type PlanId = SubscriptionPlanRow; // "free" | "pro" | "business"

/** Matches the `status` column. */
export type SubscriptionStatus = SubscriptionStatusRow;

// --- Features ---------------------------------------------------------------

/**
 * A capability the user may or may not have access to based on their plan.
 *
 * Each feature is a binary on/off flag — per-plan usage CAPS live in
 * `UsageMetric` below.
 *
 * Naming convention: `<module>.<capability>` in lowercase kebab/dot style.
 */
export type FeatureKey =
  // Invoices
  | "invoices.custom_branding"
  | "invoices.payment_links"
  | "invoices.payment_gateway"
  | "invoices.recurring"
  | "invoices.advanced_templates"
  // Clients
  | "clients.portal"
  | "clients.custom_portal_branding"
  // Projects
  | "projects.files"
  | "projects.collaborators"
  // Contracts
  | "contracts.e_signature"
  | "contracts.templates_library"
  // Time tracking
  | "time.tracking"
  | "time.billable_rates"
  | "time.reports_export"
  // Pulse finance
  | "pulse.advanced_reports"
  | "pulse.gst_reports"
  // Platform
  | "platform.api_access"
  | "platform.remove_branding"
  | "platform.priority_support";

// --- Modules (for coarse-grained route-level gating) ------------------------

/**
 * High-level modules that correspond to `/dashboard/<module>` URLs.
 *
 * Used by middleware-adjacent guards to enforce access at route-entry time
 * before any feature-level checks fire.
 */
export type ModuleKey =
  | "dashboard"
  | "clients"
  | "projects"
  | "invoices"
  | "contracts"
  | "time"
  | "pulse"
  | "portal"
  | "notifications"
  | "settings";

// --- Usage metrics ----------------------------------------------------------

/**
 * Countable resources, billed per calendar month.
 *
 * Every metric must be backed by an entry in the `USAGE_LIMITS` table in
 * `./plans.ts`. DB-side increments go through the SQL fn
 * `public.increment_usage(user_id, metric, delta)`.
 */
export type UsageMetric =
  | "invoices_created"
  | "clients_created"
  | "projects_created"
  | "contracts_sent"
  | "storage_bytes"
  | "ai_messages";

/**
 * `Infinity` represents "unlimited" in the limit tables. JSON-safe because
 * we never serialise limits over the wire — they're inlined at build time.
 */
export type LimitValue = number;

// --- Aggregate view-models --------------------------------------------------

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  /** Monthly price in the smallest currency unit (paise). `null` = custom. */
  priceMonthlyPaise: number | null;
  /** Yearly price in paise, or null if not offered. */
  priceYearlyPaise: number | null;
  currency: "INR";
  /** Whether this plan can be self-selected in the UI. */
  selfServe: boolean;
  /** Binary feature flags (only those set to true are granted). */
  features: Partial<Record<FeatureKey, true>>;
  /** Countable caps per month. Use `Infinity` for unlimited. */
  limits: Record<UsageMetric, LimitValue>;
  /** Modules accessible on this plan. */
  modules: ModuleKey[];
}

export interface CurrentSubscription {
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  razorpaySubscriptionId: string | null;
}

export interface UsageSnapshot {
  metric: UsageMetric;
  used: number;
  limit: LimitValue;
  /** 0..1. `Infinity` limits always yield 0. */
  utilisation: number;
  /** true when `used >= limit` (always false for unlimited). */
  exceeded: boolean;
  remaining: number;
  periodStart: string;
  periodEnd: string;
}
