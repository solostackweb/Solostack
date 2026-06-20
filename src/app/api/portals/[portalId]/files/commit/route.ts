/**
 *   POST /api/portals/<portalId>/files/commit
 *
 * Called by the browser AFTER a successful PUT to the presigned URL.
 * We:
 *   1. HEAD R2 to confirm the object actually exists + sniff size.
 *   2. Verify the freelancer's storage quota one final time.
 *   3. Insert the `portal_files` row.
 *   4. Emit a `file.uploaded` portal_activity event.
 */

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headObject, isR2Configured } from "@/lib/r2/client";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { getClientIp, portalUploadLimit } from "@/lib/rate-limit";
import {
  PortalAccessError,
  recordPortalActivity,
  requirePortalAccess,
} from "@/features/portals/server";
import { PORTAL_STORAGE_CAP_BYTES } from "@/features/portals/storage";
import {
  portalClientHome,
  portalDashboardDetail,
} from "@/features/portals/routes";
import { dispatchPortalFileUploadedComms } from "@/features/portals/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = [
  "contract", "deliverable", "asset", "invoice", "meeting_note", "misc",
] as const;

const inputSchema = z.object({
  fileId: z.string().uuid(),
  key: z.string().trim().min(1).max(2000),
  filename: z.string().trim().min(1).max(300),
  mimeType: z.string().trim().min(1).max(255),
  category: z.enum(VALID_CATEGORIES).optional().default("misc"),
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
  // Access-only guard (see presign route): clients must be able to upload, and
  // requireFeature() redirects to HTML for non-owners.
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
      { ok: false, error: "Invalid input." },
      { status: 400 },
    );
  }

  // Verify the upload landed in R2. Without this check a malicious caller
  // could insert a `portal_files` row pointing at a non-existent key.
  const head = await headObject(parsed.data.key);
  if (!head) {
    return NextResponse.json(
      { ok: false, error: "Upload did not complete. Please retry." },
      { status: 400 },
    );
  }

  // Hard quota re-check now that we know the actual on-disk size.
  const cap = PORTAL_STORAGE_CAP_BYTES;
  const admin = getAdminSupabase();
  if (Number.isFinite(cap)) {
    const { data: usageRow } = await admin
      .from("portal_storage_usage")
      .select("total_bytes")
      .eq("portal_id", portalId)
      .maybeSingle();
    const used = (usageRow as { total_bytes?: number } | null)?.total_bytes ?? 0;
    if (used + head.size > cap) {
      // Out of quota — purge the orphaned R2 object and refuse.
      try {
        const { deleteObject } = await import("@/lib/r2/client");
        await deleteObject(parsed.data.key);
      } catch {
        /* swallow — the GC cron will sweep it later */
      }
      return NextResponse.json(
        {
          ok: false,
          error: "This portal is full. Remove some files to free up space.",
        },
        { status: 402 },
      );
    }
  }

  const { error: insertErr } = await admin.from("portal_files").insert({
    id: parsed.data.fileId,
    portal_id: portalId,
    uploaded_by: access.userId,
    r2_key: parsed.data.key,
    name: parsed.data.filename,
    size_bytes: head.size,
    mime_type: head.contentType ?? parsed.data.mimeType,
    category: parsed.data.category,
  } as never);
  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: insertErr.message },
      { status: 500 },
    );
  }

  await recordPortalActivity({
    portalId,
    actorId: access.userId,
    type: "file.uploaded",
    payload: {
      fileId: parsed.data.fileId,
      name: parsed.data.filename,
      size: head.size,
    },
  });

  // Fire-and-forget comms (email + in-app notification for the client)
  void dispatchPortalFileUploadedComms({
    portalId,
    actorUserId: access.userId,
    fileName: parsed.data.filename,
    fileCount: 1,
    idempotencyKey: `file_uploaded:${parsed.data.fileId}`,
  });

  revalidatePath(portalClientHome(portalId));
  revalidatePath(portalDashboardDetail(portalId));

  return NextResponse.json({
    ok: true,
    fileId: parsed.data.fileId,
    sizeBytes: head.size,
  });
}
