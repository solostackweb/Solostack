/**
 * Per-portal storage policy.
 *
 * Files are hosted on Cloudflare R2 (free tier = 10 GB). To stay safely inside
 * that ceiling we cap each portal at a fixed budget. This also doubles as a
 * natural future Pro upsell ("need more than 100 MB?").
 *
 * Pure constants/helpers — safe to import on both server and client.
 */

/** Fixed per-portal storage budget: 100 MB. */
export const PORTAL_STORAGE_CAP_BYTES = 100 * 1024 * 1024;

/**
 * Effective cap for a portal = the smaller of the freelancer's plan limit and
 * the fixed per-portal budget. Falls back to the per-portal budget when the
 * plan limit is unbounded (Infinity).
 */
export function effectivePortalStorageCap(planCapBytes: number): number {
  if (!Number.isFinite(planCapBytes)) return PORTAL_STORAGE_CAP_BYTES;
  return Math.min(planCapBytes, PORTAL_STORAGE_CAP_BYTES);
}

/** Usage tone for the storage meter. */
export function storageTone(usedBytes: number, capBytes: number): "ok" | "warn" | "full" {
  if (!Number.isFinite(capBytes) || capBytes <= 0) return "ok";
  const pct = (usedBytes / capBytes) * 100;
  if (pct >= 95) return "full";
  if (pct >= 80) return "warn";
  return "ok";
}
