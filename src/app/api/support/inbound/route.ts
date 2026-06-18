/**
 * POST /api/support/inbound
 *
 * Receives a parsed inbound support email from the Cloudflare Email Worker
 * (see infra/cloudflare-email-worker). The worker authenticates with a shared
 * secret in the Authorization header:
 *
 *   Authorization: Bearer <SUPPORT_INBOUND_SECRET>
 *
 * Body (JSON):
 *   { token?, messageId?, from, fromName?, subject?, text }
 *
 * The handler is idempotent on `messageId` (unique index on
 * support_messages.external_message_id), so Cloudflare retries can't
 * double-post a reply.
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireServerEnv } from "@/config/env";
import { log } from "@/lib/logger";
import { ingestInboundEmail, type InboundEmail } from "@/features/support/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.supportInboundSecret) {
    return new NextResponse("Not configured", { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const presented = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!presented || !timingSafeEqual(presented, env.supportInboundSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: Partial<InboundEmail>;
  try {
    payload = (await req.json()) as Partial<InboundEmail>;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (!payload.from || typeof payload.from !== "string" || typeof payload.text !== "string") {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const result = await ingestInboundEmail({
    token: payload.token ?? null,
    messageId: payload.messageId ?? null,
    from: payload.from,
    fromName: payload.fromName ?? null,
    subject: payload.subject ?? null,
    text: payload.text,
  });

  if (!result.ok) {
    log.warn("support.inbound.rejected", { error: result.error });
    // 200 with ok:false for "empty body" type no-ops so the worker doesn't retry;
    // 500 only for genuine server failures.
    const retryable = result.error === "create_failed" || result.error === "message_failed";
    return NextResponse.json(result, { status: retryable ? 500 : 200 });
  }

  return NextResponse.json(result, { status: 200 });
}
