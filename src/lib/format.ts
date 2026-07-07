/**
 * Currency + number formatters.
 *
 * Uses INR (₹) by default to match Stackivo's primary market. The
 * Indian numbering system (lakhs/crores) is preserved by passing the
 * `en-IN` locale to `Intl.NumberFormat`.
 */

export function formatINR(value: number, opts?: { compact?: boolean }) {
  const safe = Number.isFinite(value) ? value : 0;
  if (opts?.compact) {
    if (safe >= 10_000_000) return `₹${(safe / 10_000_000).toFixed(1)}Cr`;
    if (safe >= 100_000) return `₹${(safe / 100_000).toFixed(1)}L`;
    if (safe >= 1000) return `₹${(safe / 1000).toFixed(1)}k`;
    return `₹${safe}`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatMoney(
  value: number,
  currency = "INR",
  locale?: string,
): string {
  return formatCurrencyAmount(value, currency, locale);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  AED: "د.إ",
};

export function formatCurrencyAmount(
  value: number,
  currency = "INR",
  locale?: string,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  const cur = (currency || "INR").toUpperCase();
  const loc = locale || (cur === "INR" ? "en-IN" : "en-US");
  const symbol = CURRENCY_SYMBOLS[cur];
  const sign = safe < 0 ? "-" : "";
  const absolute = Math.abs(safe);

  try {
    const amount = new Intl.NumberFormat(loc, {
      minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(absolute);

    return symbol ? `${sign}${symbol}${amount}` : `${sign}${cur} ${amount}`;
  } catch {
    return `${sign}${symbol ?? `${cur} `}${absolute.toFixed(2)}`;
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatPercent(value: number, fractionDigits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

export function formatRelativeTime(iso: string) {
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - target;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}
