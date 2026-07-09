import "server-only";

/**
 * Founder-console metrics cache (Admin hardening A1).
 *
 * The Now page used to recompute ~a dozen filtered COUNTs on every visit.
 * This module snapshots them into the single-row `admin_metrics` table:
 *
 *   refreshAdminMetrics()  - recompute + persist (called by the monitor cron).
 *   getAdminNowData()      - read the cache; if stale/missing, compute live,
 *                            persist, and return (self-healing).
 *
 * Numbers stay EXACT (cached, not estimated) - founders want real figures.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import {
  getRevenueSnapshot,
  getPipelineSnapshot,
  getCommsSnapshot,
  type RevenueSnapshot,
  type PipelineSnapshot,
  type CommsSnapshot,
} from "./queries";
import { getSupportPulse, type SupportPulse } from "@/features/support/admin-queries";
import { getSupportMetrics, type SupportMetrics } from "@/features/support/admin-tickets";

/** Snapshot the Now page renders. */
export interface AdminSnapshots {
  revenue: RevenueSnapshot;
  pipeline: PipelineSnapshot;
  comms: CommsSnapshot;
  support: SupportPulse;
  supportMetrics: SupportMetrics;
}

export interface AdminNowData extends AdminSnapshots {
  /** When the figures were computed. */
  computedAt: string;
  /** True when served from the cache (vs freshly computed this request). */
  cached: boolean;
}

/** Default freshness window for the Now page (10 minutes). */
const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

/** Compute all snapshots live (parallel). */
async function computeSnapshots(): Promise<AdminSnapshots> {
  const [revenue, pipeline, comms, support, supportMetrics] = await Promise.all([
    getRevenueSnapshot(),
    getPipelineSnapshot(),
    getCommsSnapshot(),
    getSupportPulse(),
    getSupportMetrics(),
  ]);
  return { revenue, pipeline, comms, support, supportMetrics };
}

/** Recompute snapshots and persist to admin_metrics. Best-effort. */
export async function refreshAdminMetrics(): Promise<AdminSnapshots | null> {
  try {
    const snapshots = await computeSnapshots();
    const admin = getAdminSupabase();
    await admin
      .from("admin_metrics")
      .upsert(
        { id: 1, data: snapshots as unknown as Record<string, unknown>, computed_at: new Date().toISOString() } as never,
        { onConflict: "id" },
      );
    return snapshots;
  } catch (err) {
    log.warn("admin.metrics.refresh_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Read the Now-page figures. Returns the cached snapshot when fresh;
 * otherwise computes live, persists, and returns (self-healing so it never
 * depends solely on the cron).
 */
export async function getAdminNowData(
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<AdminNowData> {
  const admin = getAdminSupabase();

  try {
    const { data } = await admin
      .from("admin_metrics")
      .select("data, computed_at")
      .eq("id", 1)
      .maybeSingle();

    const row = data as { data: AdminSnapshots; computed_at: string } | null;
    if (row?.data && row.computed_at) {
      const ageMs = Date.now() - Date.parse(row.computed_at);
      const hasShape =
        row.data.revenue && row.data.pipeline && row.data.comms && row.data.support && row.data.supportMetrics;
      if (hasShape && ageMs < maxAgeMs) {
        return { ...row.data, computedAt: row.computed_at, cached: true };
      }
    }
  } catch (err) {
    log.warn("admin.metrics.read_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Stale or missing -> compute live, persist for next time.
  const fresh = (await refreshAdminMetrics()) ?? (await computeSnapshots());
  return { ...fresh, computedAt: new Date().toISOString(), cached: false };
}
