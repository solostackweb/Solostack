/**
 * Admin-side display formatters.
 *
 * Kept separate from `@/lib/format` (customer-app focused) so admin
 * tweaks (e.g. compact INR display, mono timestamps) don't leak into
 * customer surfaces.
 */

/**
 * Format paise (integer) → human readable INR string. Always uses
 * Indian digit grouping. Defaults to "₹0" for null / undefined.
 */
export function formatPaiseInr(paise: number | null | undefined): string {
  const v = Math.round((paise ?? 0) / 100);
  return `₹${v.toLocaleString("en-IN")}`;
}

export function formatCurrencyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  const code = (currency || "INR").toUpperCase();
  const value = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
}

/**
 * Format an ISO timestamp as "YYYY-MM-DD HH:mm" in IST. Stable string
 * with no locale jitter — admins want monospaced grep-able output.
 */
export function formatIstStamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  } catch {
    return iso;
  }
}

/**
 * Human-friendly relative time ("2m ago", "3h ago", "5d ago").
 */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (Number.isNaN(diffSec)) return "—";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.round(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  const diffYr = Math.round(diffMo / 12);
  return `${diffYr}y ago`;
}

/**
 * Truncate a UUID for display. Preserves leading 8 chars + final 4.
 *   "abcdef12-1234-5678-9abc-def012345678" → "abcdef12…5678"
 */
export function shortenId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}
