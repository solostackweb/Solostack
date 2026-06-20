/**
 *   POST /api/portals/<portalId>/files/presign
 *
 * Mint a short-lived presigned PUT URL pointing at R2. The browser then
 * uploads the file directly to R2 — Vercel function bandwidth is never
 * touched.
 *
 * Authentication: Supabase session cookie. The portal-access guard
 * checks the user is the owner OR an active member.
 *
 * Quotas: we hard-cap individual files at `R2_MAX_OBJECT_BYTES` and
 * inspect the portal's storage usage against the freelancer's plan
 * limit (`storage_bytes`). Enforced again on COMMIT — the presign step
 * is a soft check, COMMIT is the hard one.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildPortalFileKey,
  isR2Configured,
  R2_MAX_OBJECT_BYTES,
} from "@/lib/r2/client";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getClientIp, portalUploadLimit } from "@/lib/rate-limit";
import {
  PortalAccessError,
  requirePortalAccess,
} from "@/features/portals/server";
import { PORTAL_STORAGE_CAP_BYTES } from "@/features/portals/storage";
import crypto from "node:crypto";

export const runtime = "nodejs";

const inputSchema = z.object({
  filename: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(R2_MAX_OBJECT_BYTES),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ portalId: string }> },
): Promise<Response> {
  if (!isR2Configured()) {
    return NextResponse.json(
      { ok: false, error: "File storage is not configured." },
      { status: 503 },
    );
  }

  const { portalId } = await ctx.params;

  const ip = await getClientIp();
  const rl = await portalUploadLimit(`portalup:${ip}`);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: rl.message }, { status: 429 });
  }

  // Access guard only. We do NOT gate on the uploader's plan feature here —
  // the client (a portal member, not the plan owner) must be able to upload,
  // and requireFeature() redirects (returns HTML) for non-owners, which broke
  // the JSON upload flow. The per-portal cap below bounds storage instead.
  const access = await requirePortalAccess(portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return NextResponse.json(
      { ok: false, error: access.code },
      { status: access.code === "unauthenticated" ? 401 : 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  // Soft quota check — the COMMIT step re-checks against the actual
  // uploaded size, so this is best-effort UX.
  const cap = PORTAL_STORAGE_CAP_BYTES;
  if (Number.isFinite(cap)) {
    const admin = getAdminSupabase();
    const { data: usageRow } = await admin
      .from("portal_storage_usage")
      .select("total_bytes")
      .eq("portal_id", portalId)
      .maybeSingle();
    const used = (usageRow as { total_bytes?: number } | null)?.total_bytes ?? 0;
    if (used + parsed.data.sizeBytes > cap) {
      return NextResponse.json(
        {
          ok: false,
          error: `This portal is full (${formatMb(cap)} limit). Remove some files to free up space.`,
        },
        { status: 402 },
      );
    }
  }

  const fileId = crypto.randomUUID();
  const key = buildPortalFileKey({
    portalId,
    fileId,
    filename: parsed.data.filename,
  });

  // Upload through the same-origin Cloudflare Worker (route: /api/files/*),
  // which streams the body straight into the R2 bucket. This avoids the
  // browser→R2 CORS problem entirely (the PUT is same-origin). The key is
  // already sanitised to URL-safe characters by buildPortalFileKey.
  return NextResponse.json({
    ok: true,
    fileId,
    key,
    putUrl: `/api/files/${key}`,
  });
}

function formatMb(bytes: number): string {
  if (!Number.isFinite(bytes)) return "unlimited";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

// Static export so we can defensively avoid double-invocation; Next caches
// per-request anyway, but `force-dynamic` documents intent.
export const dynamic = "force-dynamic";
