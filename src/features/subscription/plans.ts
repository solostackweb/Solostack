/**
 * Plan catalogue — single source of truth for features, limits, and modules.
 *
 * To add a new plan or change what a plan offers, edit this file only. All
 * gating logic (`./features.ts`), the subscription UI, and server-side
 * entitlement checks read from these tables.
 *
 * Money values are in the smallest currency unit (paise) for INR, matching
 * Razorpay's API.
 */

import type {
  FeatureKey,
  ModuleKey,
  PlanDefinition,
  PlanId,
  UsageMetric,
} from "./types";

// --- Order plans from least to most powerful --------------------------------
export const PLAN_ORDER: readonly PlanId[] = ["free", "pro", "business"] as const;

/**
 * Returns -1 / 0 / 1 telling you whether `a` is a lesser/equal/greater plan
 * than `b`. Use for "is the user on at least X?" checks:
 *
 *   if (comparePlans(sub.plan, "pro") >= 0) { ... }
 */
export function comparePlans(a: PlanId, b: PlanId): number {
  return PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);
}

// --- Shared module lists ----------------------------------------------------
const ALL_MODULES: ModuleKey[] = [
  "dashboard",
  "clients",
  "projects",
  "invoices",
  "contracts",
  "time",
  "pulse",
  "portal",
  "notifications",
  "settings",
];

/** Free plan only gets basic modules — contracts and portal are Pro+ */
const FREE_MODULES: ModuleKey[] = [
  "dashboard",
  "clients",
  "projects",
  "invoices",
  "contracts",
  "time",
  "pulse",
  "notifications",
  "settings",
];

// --- Plan catalogue ---------------------------------------------------------
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    description: "Run your solo practice with the essentials.",
    priceMonthlyPaise: 0,
    priceYearlyPaise: 0,
    currency: "INR",
    selfServe: true,
    features: {
      // Free plan: invoice sharing + payment gateway (all three methods free).
      // There is no per-transaction cut — Razorpay fees are passed through.
      "invoices.payment_links": true,
      "invoices.payment_gateway": true,
    },
    limits: {
      // Free plan: LIFETIME client count capped at 5. Deletes do NOT
      // decrement. All other usage is unlimited on the free tier.
      invoices_created: Infinity,
      clients_created: 5,
      projects_created: Infinity,
      contracts_sent: 0,
      storage_bytes: 100 * 1024 * 1024, // 100 MB
      ai_messages: 20, // AI assistant replies / month
    },
    modules: FREE_MODULES,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Unlock contracts, the client portal, and custom branding.",
    priceMonthlyPaise: 49900,  // ₹499/mo
    priceYearlyPaise: 478800,  // ₹399/mo × 12 = ₹4,788/yr (2 months free)
    currency: "INR",
    selfServe: true,
    features: {
      "invoices.custom_branding": true,
      "invoices.payment_links": true,
      "invoices.payment_gateway": true,
      "invoices.recurring": true,
      "invoices.advanced_templates": true,
      "clients.portal": true,
      "projects.files": true,
      "contracts.e_signature": true,
      "contracts.templates_library": true,
      "time.tracking": true,
      "time.billable_rates": true,
      "time.reports_export": true,
      "pulse.advanced_reports": true,
      "pulse.gst_reports": true,
      "platform.remove_branding": true,
    },
    limits: {
      invoices_created: Infinity,
      clients_created: Infinity,
      projects_created: Infinity,
      contracts_sent: Infinity,
      storage_bytes: 5 * 1024 * 1024 * 1024, // 5 GB
      ai_messages: 100, // AI assistant replies / month
    },
    modules: ALL_MODULES,
  },
  business: {
    id: "business",
    name: "Business",
    description:
      "Everything in Pro, plus API access, collaborators, and priority support.",
    priceMonthlyPaise: 149900,  // ₹1,499/mo
    priceYearlyPaise: 1438800,  // ₹1,199/mo × 12 = ₹14,388/yr (2 months free)
    currency: "INR",
    selfServe: true,
    features: {
      "invoices.custom_branding": true,
      "invoices.payment_links": true,
      "invoices.payment_gateway": true,
      "invoices.recurring": true,
      "invoices.advanced_templates": true,
      "clients.portal": true,
      "clients.custom_portal_branding": true,
      "projects.files": true,
      "projects.collaborators": true,
      "contracts.e_signature": true,
      "contracts.templates_library": true,
      "time.tracking": true,
      "time.billable_rates": true,
      "time.reports_export": true,
      "pulse.advanced_reports": true,
      "pulse.gst_reports": true,
      "platform.api_access": true,
      "platform.remove_branding": true,
      "platform.priority_support": true,
    },
    limits: {
      invoices_created: Infinity,
      clients_created: Infinity,
      projects_created: Infinity,
      contracts_sent: Infinity,
      storage_bytes: 50 * 1024 * 1024 * 1024, // 50 GB
      ai_messages: 500, // AI assistant replies / month
    },
    modules: ALL_MODULES,
  },
};

export function getPlan(id: PlanId): PlanDefinition {
  return PLANS[id];
}

/** Returns every plan in display order. Safe for UI pickers. */
export function listPlans(): PlanDefinition[] {
  return PLAN_ORDER.map((id) => PLANS[id]);
}

/**
 * Find the lowest plan that grants a given feature. Useful for "Upgrade to
 * X to unlock Y" copy in the UpgradeCard component.
 */
export function minimumPlanFor(feature: FeatureKey): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (PLANS[id].features[feature]) return id;
  }
  return null;
}

/** Find the lowest plan whose monthly cap on `metric` is at least `needed`. */
export function minimumPlanForLimit(
  metric: UsageMetric,
  needed: number,
): PlanId | null {
  for (const id of PLAN_ORDER) {
    const cap = PLANS[id].limits[metric];
    if (cap >= needed) return id;
  }
  return null;
}


/**
 * Per-plan output-token ceiling for a single AI assistant reply. Bounds the
 * worst-case cost/length of any one answer; conversational replies are short,
 * so this only caps outliers. Higher tiers get roomier answers.
 */
export const AI_REPLY_MAX_TOKENS: Record<PlanId, number> = {
  free: 700,
  pro: 1500,
  business: 2500,
};
