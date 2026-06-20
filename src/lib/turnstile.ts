import "server-only";

import { randomUUID } from "node:crypto";
import { requireServerEnv } from "@/config/env";
import { log } from "@/lib/logger";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

export type TurnstileVerification =
  | { ok: true; skipped?: boolean }
  | { ok: false; error: string };

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileVerification> {
  const env = requireServerEnv();

  if (!env.turnstileSecretKey || !env.turnstileSiteKey) {
    return { ok: true, skipped: true };
  }

  if (!token || token.trim().length === 0) {
    return { ok: false, error: "Security check missing. Please refresh and try again." };
  }

  try {
    const body = new FormData();
    body.set("secret", env.turnstileSecretKey);
    body.set("response", token);
    body.set("idempotency_key", randomUUID());
    if (remoteIp) body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
    });

    if (!response.ok) {
      log.warn("turnstile.verify.http_failed", { status: response.status });
      return { ok: false, error: "Security check failed. Please refresh and try again." };
    }

    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) {
      log.warn("turnstile.verify.rejected", {
        errors: result["error-codes"] ?? [],
        hostname: result.hostname,
        action: result.action,
      });
      return { ok: false, error: "Security check failed. Please refresh and try again." };
    }

    return { ok: true };
  } catch (err) {
    log.warn("turnstile.verify.unexpected_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Security check unavailable. Please try again in a moment." };
  }
}
