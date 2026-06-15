/**
 *   GET /api/portals/<portalId>/contact.vcf
 *
 * Generates a vCard for the portal owner (the freelancer) so the client can
 * save them to contacts in one tap. Authenticated via portal access.
 */

import { NextResponse } from "next/server";
import {
  PortalAccessError,
  requirePortalAccess,
} from "@/features/portals/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portalId: string }> },
): Promise<Response> {
  const { portalId } = await params;

  const access = await requirePortalAccess(portalId).catch(
    (e) => e as PortalAccessError,
  );
  if (access instanceof PortalAccessError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getAdminSupabase();
  const { data: portal } = await admin
    .from("portals")
    .select("owner_user_id")
    .eq("id", portalId)
    .maybeSingle();
  const ownerId = (portal as { owner_user_id?: string } | null)?.owner_user_id;
  if (!ownerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name, display_name, email, business_email, phone, business_phone, company_name, website")
    .eq("id", ownerId)
    .maybeSingle();
  const p =
    (profile as {
      full_name: string | null;
      display_name: string | null;
      email: string | null;
      business_email: string | null;
      phone: string | null;
      business_phone: string | null;
      company_name: string | null;
      website: string | null;
    } | null) ?? null;

  const name = p?.display_name || p?.full_name || "Freelancer";
  const email = p?.business_email || p?.email || "";
  const phone = p?.business_phone || p?.phone || "";

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(name)}`,
    `N:${esc(name)};;;;`,
  ];
  if (p?.company_name) lines.push(`ORG:${esc(p.company_name)}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET:${esc(email)}`);
  if (phone) lines.push(`TEL;TYPE=CELL:${esc(phone)}`);
  if (p?.website) lines.push(`URL:${esc(p.website)}`);
  lines.push("END:VCARD");

  const vcard = lines.join("\r\n") + "\r\n";
  return new Response(vcard, {
    status: 200,
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${name.replace(/[^a-z0-9]+/gi, "-")}.vcf"`,
      "cache-control": "no-store",
    },
  });
}
