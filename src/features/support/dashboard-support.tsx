"use client";

/**
 * Dashboard support layer — single mount point for the first-party live
 * chat widget. Mounted once from the (server) dashboard layout.
 * Replaces the old Crisp provider (removed fully in phase S6).
 */

import { SupportWidget } from "./components/support-widget";
import type { SupportPlan } from "./ticket-types";

interface Props {
  identity: { plan?: string | null };
}

function normalizePlan(plan: string | null | undefined): SupportPlan {
  return plan === "pro" || plan === "business" ? plan : "free";
}

export function DashboardSupportLayer({ identity }: Props) {
  return <SupportWidget plan={normalizePlan(identity.plan)} />;
}
