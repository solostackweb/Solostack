import "server-only";

/**
 * Production rate-limiting for public + auth surfaces.
 *
 * Backed by Upstash Redis via `@upstash/ratelimit`. We resolve the limiter
 * lazily at first use and gracefully no-op when the Upstash credentials are
 * not configured — that way local development and preview deploys keep
 * working without forcing every contributor to provision Redis.
 *
 * The four pre-configured limiters cover the hottest abuse vectors:
 *
 *   - `authLimiter`         → login / forgot-password (5 / 15 min / IP+email)
 *   - `signupLimiter`       → signup (3 / hour / IP)
 *   - `publicSignLimiter`   → /c/:token sign POST (5 / 10 min / IP+token)
 *   - `shareViewLimiter`    → /c/:token + /i/:token view recording (60 / hour / IP)
 *
 * Each `limit()` call returns a discriminated result. Callers should:
 *
 *     const r = await authLimiter.limit(`login:${ip}:${email}`);
 *     if (!r.ok) return { ok: false, error: r.message };
 *
 * The deliberately generic `message` avoids leaking whether the limit is
 * per-IP or per-account.
 *
 * Storage: we use sliding-window counters per Upstash's recommendation.
 *
 * Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to enable.
 */

import { requireServerEnv } from "@/config/env";
import { headers } from "next/headers";

// ----- Types --------------------------------------------------------------

interface LimitResult {
  /** True when the request is within the limit (or limiter is disabled). */
  ok: boolean;
  /** Optional user-safe message when blocked. */
  message: string;
  /** Seconds until the next window allows another request, when blocked. */
  retryAfterSeconds?: number;
}

interface LimiterConfig {
  /** Stable prefix for Redis keys — keep unique per limiter. */
  prefix: string;
  /** Max requests per window. */
  limit: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /** User-safe message returned when blocked. */
  blockedMessage: string;
}

// ----- Lazy Upstash wiring ------------------------------------------------

type RatelimitInstance = {
  limit: (key: string) => Promise<{
    success: boolean;
    reset: number; // epoch ms
  }>;
};

let cachedLimiters: Map<string, RatelimitInstance> | null = null;
let importPromise: Promise<typeof import("@upstash/ratelimit")> | null = null;
let redisPromise: Promise<typeof import("@upstash/redis")> | null = null;

async function loadDeps(): Promise<{
  Ratelimit: typeof import("@upstash/ratelimit").Ratelimit;
  Redis: typeof import("@upstash/redis").Redis;
} | null> {
  const env = requireServerEnv();
  if (!env.upstashRedisUrl || !env.upstashRedisToken) return null;
  try {
    importPromise ??= import("@upstash/ratelimit");
    redisPromise ??= import("@upstash/redis");
    const [{ Ratelimit }, { Redis }] = await Promise.all([
      importPromise,
      redisPromise,
    ]);
    return { Ratelimit, Redis };
  } catch {
    // Module not installed yet. Fail open so the app keeps working until
    // the dependency lands.
    return null;
  }
}

async function getLimiter(
  cfg: LimiterConfig,
): Promise<RatelimitInstance | null> {
  const deps = await loadDeps();
  if (!deps) return null;
  const env = requireServerEnv();
  if (!env.upstashRedisUrl || !env.upstashRedisToken) return null;

  cachedLimiters ??= new Map();
  const existing = cachedLimiters.get(cfg.prefix);
  if (existing) return existing;

  const redis = new deps.Redis({
    url: env.upstashRedisUrl,
    token: env.upstashRedisToken,
  });

  const limiter = new deps.Ratelimit({
    redis,
    limiter: deps.Ratelimit.slidingWindow(cfg.limit, `${cfg.windowSeconds} s`),
    prefix: `stackivo:${cfg.prefix}`,
    analytics: false,
  });
  cachedLimiters.set(cfg.prefix, limiter as unknown as RatelimitInstance);
  return limiter as unknown as RatelimitInstance;
}

// ----- Public API ----------------------------------------------------------

/**
 * Resolve the caller's IP address from the request headers in priority
 * order. Returns `"unknown"` so a single anonymous bucket exists rather
 * than the limiter being silently bypassed.
 *
 * Trusts `x-forwarded-for` because the only deployment target is Vercel
 * which sets this header for the real client IP and discards any
 * incoming spoofed value at the edge.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

async function runLimiter(
  cfg: LimiterConfig,
  key: string,
): Promise<LimitResult> {
  const limiter = await getLimiter(cfg);
  if (!limiter) {
    // Fail open — no Upstash, no limit.
    return { ok: true, message: "" };
  }
  const result = await limiter.limit(key);
  if (result.success) return { ok: true, message: "" };
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((result.reset - Date.now()) / 1000),
  );
  return {
    ok: false,
    message: cfg.blockedMessage,
    retryAfterSeconds,
  };
}

// ----- Pre-configured limiters --------------------------------------------

export async function authLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "auth",
      limit: 5,
      windowSeconds: 15 * 60,
      blockedMessage:
        "Too many sign-in attempts. Please wait a few minutes and try again.",
    },
    key,
  );
}

export async function signupLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "signup",
      limit: 3,
      windowSeconds: 60 * 60,
      blockedMessage:
        "We've received many signup attempts from this network. Please try again later.",
    },
    key,
  );
}

export async function passwordResetLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "pwreset",
      limit: 3,
      windowSeconds: 60 * 60,
      blockedMessage:
        "Too many password reset requests. Please wait and try again.",
    },
    key,
  );
}

export async function publicSignLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "sign",
      limit: 5,
      windowSeconds: 10 * 60,
      blockedMessage:
        "Too many signing attempts. Please refresh the page and try again.",
    },
    key,
  );
}

export async function shareViewLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "view",
      limit: 60,
      windowSeconds: 60 * 60,
      blockedMessage: "View recording temporarily paused.",
    },
    key,
  );
}

/**
 * Per-user cap on outbound transactional email.
 *
 * Protects the Brevo sender reputation (a hijacked account otherwise
 * makes it trivial to spam every client in the tenant's directory) and
 * stays well above any realistic legitimate burst: a freelancer
 * occasionally fires 5-10 invoices back-to-back on invoicing day.
 */
export async function emailSendLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "emailsend",
      limit: 20,
      windowSeconds: 10 * 60,
      blockedMessage:
        "You've sent a lot of emails recently. Please wait a few minutes before sending more.",
    },
    key,
  );
}
/**
 * Founder-console write actions — generous ceiling that still stops a runaway
 * script or a compromised admin session from hammering mutations. Keyed per
 * admin (see runAdminAction). Fails open when Upstash isn't configured.
 */
export async function adminWriteLimit(key: string): Promise<LimitResult> {
  return runLimiter(
    {
      prefix: "adminwrite",
      limit: 120,
      windowSeconds: 60,
      blockedMessage:
        "Too many admin actions in a short window. Please slow down and retry shortly.",
    },
    key,
  );
}
