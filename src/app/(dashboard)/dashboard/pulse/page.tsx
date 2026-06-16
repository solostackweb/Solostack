import { BarChart3 } from "lucide-react";
import {
  PulseDashboardView,
  type PulseRange,
  type PulseTopClient,
} from "@/features/pulse/components/pulse-dashboard-view";
import { getPulseAnalytics } from "@/features/pulse/analytics";
import { getPulseInsights } from "@/features/pulse/insights";
import { getClientRevenue } from "@/features/pulse/server";
import { mapClientRow, type ClientRecord } from "@/features/clients/server";
import { getServerSupabase } from "@/lib/supabase/server";
import type { ClientRow } from "@/lib/supabase/types";
import { canUseFeature } from "@/features/subscription/server";
import { PageHeader } from "@/components/shared/page-header";
import { UpgradeWall } from "@/components/shared/upgrade-wall";

export const metadata = { title: "Pulse" };
export const dynamic = "force-dynamic";

const RANGE_MONTHS: Record<PulseRange, number> = { "3m": 3, "6m": 6, "12m": 12 };

function parseRange(value: string | undefined): PulseRange {
  return value === "3m" || value === "6m" || value === "12m" ? value : "6m";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ".";
  const first = parts[0]![0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "";
  return (first + last).toUpperCase() || ".";
}

async function hydrateTopClients(): Promise<PulseTopClient[]> {
  const rows = await getClientRevenue(8);
  const ids = rows.map((r) => r.clientId).filter((id): id is string => Boolean(id));
  const map = new Map<string, ClientRecord>();
  if (ids.length > 0) {
    const supabase = await getServerSupabase();
    const { data } = await supabase.from("clients").select("*").in("id", ids);
    for (const row of (data as unknown as ClientRow[]) ?? []) {
      const c = mapClientRow(row);
      map.set(c.id, c);
    }
  }
  return rows.map((r) => {
    const c = r.clientId ? map.get(r.clientId) : undefined;
    const name = c?.businessName ?? c?.fullName ?? "Unknown client";
    return {
      clientId: r.clientId,
      name,
      initials: initialsFromName(name),
      totalPaid: r.totalPaid,
      invoiceCount: r.invoiceCount,
    };
  });
}

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const [sp, allowed] = await Promise.all([
    searchParams,
    canUseFeature("pulse.advanced_reports"),
  ]);

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pulse"
          description="Your paid revenue, top clients, and business trends."
        />
        <UpgradeWall
          icon={BarChart3}
          feature="Pulse"
          title="Advanced analytics are a Pro feature"
          description="See your full revenue history, receivables, collection metrics, GST summaries, and export-ready reports — so you can make smart decisions about your business."
          benefits={[
            "Revenue with month-over-month trend + receivables aging",
            "Collection rate and average days-to-pay",
            "GST summary (when registered) and client analytics",
            "CSV + branded PDF financial reports",
          ]}
          requiredPlan="Pro"
        />
      </div>
    );
  }

  const range = parseRange(sp.range);
  const hasCustom = Boolean(sp.from && sp.to);
  const months = RANGE_MONTHS[range];
  const now = new Date();
  const to = hasCustom ? sp.to! : now.toISOString().slice(0, 10);
  const from = hasCustom
    ? sp.from!
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
        .toISOString()
        .slice(0, 10);

  const [analytics, insights, topClients] = await Promise.all([
    getPulseAnalytics({ from, to }),
    getPulseInsights({ from, to }),
    hydrateTopClients(),
  ]);

  return (
    <PulseDashboardView
      analytics={analytics}
      insights={insights}
      topClients={topClients}
      range={range}
      custom={{ from: hasCustom ? sp.from! : "", to: hasCustom ? sp.to! : "" }}
    />
  );
}
