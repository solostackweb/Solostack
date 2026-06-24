import "server-only";

/**
 * Foreign-exchange rates for INR-equivalent reporting.
 *
 * Source: frankfurter.app (free, keyless, ECB data). We fetch on demand and
 * cache per-currency for the day, so Pulse/books get a stable INR figure
 * without a paid FX provider. The rate is meant to be *locked onto the invoice
 * at issue time* — callers store the returned rate so later rate moves don't
 * change historical numbers.
 *
 * Always fails soft: if the network/API is unavailable we return null and the
 * caller decides (e.g. ask the freelancer to enter a rate, or store null).
 */

import { log } from "@/lib/logger";

interface CacheEntry {
  rate: number;
  day: string; // YYYY-MM-DD the rate was fetched for
}

const cache = new Map<string, CacheEntry>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * INR per 1 unit of `currency` (e.g. USD → ~83). Returns 1 for INR, null on
 * failure. `currency` is an ISO-4217 code.
 */
export async function getFxRateToInr(currency: string): Promise<number | null> {
  const code = (currency || "").trim().toUpperCase();
  if (!code || code === "INR") return 1;

  const cached = cache.get(code);
  const day = today();
  if (cached && cached.day === day) return cached.rate;

  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(code)}&to=INR`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    const json = (await res.json()) as { rates?: { INR?: number } };
    const rate = json.rates?.INR;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
      throw new Error("no INR rate in response");
    }
    cache.set(code, { rate, day });
    return rate;
  } catch (err) {
    log.warn("fx.rate_fetch_failed", {
      currency: code,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall back to a stale cached value if we have one.
    return cached?.rate ?? null;
  }
}

/**
 * Convert an amount in `currency` to INR using the live/locked rate.
 * Returns null if the rate is unavailable (caller decides how to handle).
 */
export async function toInr(
  amount: number,
  currency: string,
): Promise<{ inr: number; rate: number } | null> {
  const rate = await getFxRateToInr(currency);
  if (rate === null) return null;
  return { inr: Math.round(amount * rate * 100) / 100, rate };
}
