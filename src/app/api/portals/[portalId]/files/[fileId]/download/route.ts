/**
 *   GET /api/portals/<portalId>/files/<fileId>/download
 *
 * Issues a 5-minute presigned GET URL for an R2 object and 302's the
 * caller to it. We don't proxy the download through Vercel because:
 *   - R2 egress is free; Vercel function bandwidth is metered.
 *   - Browsers handle Content-Disposition + range requests natively when
 *     hitting R2 directly.
 *
 * The portal-access guard ensures only members of the portal (or its
 * owner) can mint a URL. Once issued the URL is unforgeable but expires
 * within 5 minutes, so a leaked URL is low-impact.
 */

import { NextResponse } from "next/server";
import { presignGet, isInlineSafeMime, isR2Configured } from "@/lib/r2/client";
import { getAdminSupabase } from "@/lib/supabase/admin";
import {
  PortalAccessError,
  requirePortalAccess,
} from "@/features/portals/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ portalId: string; fileId: string }> },
): Promise<Response> {
  if (!isR2Configured()) {
    return new NextResponse("File storage not configured.", { status: 503 });
  }
  const { portalId, fileId } = await ctx.params;

  const access = await requirePortalAccess(portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return new NextResponse(access.code, {
      status: access.code === "unauthenticated" ? 401 : 403,
    });
  }

  const admin = getAdminSupabase();
  const { data: row } = await admin
    .from("portal_files")
    .select("id, r2_key, name, mime_type, deleted_at, portal_id")
    .eq("id", fileId)
    .eq("portal_id", portalId)
    .maybeSingle();
  const file = row as
    | {
        id: string;
        r2_key: string;
        name: string;
        mime_type: string | null;
        deleted_at: string | null;
      }
    | null;
  if (!file || file.deleted_at) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Only render inline when explicitly previewing AND the stored type is
  // browser-safe (PDF / raster image). Everything else is forced to download
  // so a stored file can never execute script in any origin.
  const wantsPreview =
    new URL(req.url).searchParams.get("preview") === "1";
  const disposition =
    wantsPreview && isInlineSafeMime(file.mime_type) ? "inline" : "attachment";

  const presigned = await presignGet({
    key: file.r2_key,
    downloadFilename: file.name,
    disposition,
    forcePresign: true,
  });

  return NextResponse.redirect(presigned.url, 302);
}
