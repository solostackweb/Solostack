/**
 * POST /api/admin/view-as/start
 *
 * Body: `application/x-www-form-urlencoded` with `userId=<uuid>`.
 *
 * Wraps the server action so a `<form action="/api/admin/view-as/start">`
 * can post directly from inside the user detail page. The action
 * itself handles authz (`requireAdmin()` inside `runAdminAction`).
 */

import { NextResponse } from "next/server";
import { startViewAsAction } from "@/features/admin/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const userId = String(form.get("userId") ?? "");
  const result = await startViewAsAction(userId);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  // Keep the admin in the founder console. The customer-facing dashboard is
  // session/RLS-scoped and does not yet support service-role impersonation.
  // View-as mode currently means read-only admin review with writes disabled.
  return NextResponse.redirect(new URL(`/admin/users/${userId}`, req.url), 303);
}
