import { NextResponse } from "next/server";

import { listIvoPickerOptionsAction } from "@/features/ai-workflows/read-actions";

/**
 * Picker options for the Ivo assistant composer (@ mentions) and workflow
 * pickers, served as plain JSON over GET.
 *
 * This read used to travel over the server-action channel, where its response
 * could silently fail to resolve the caller's promise (dropped dispatch /
 * unresolved Flight stream when the panel warms up mid-navigation). A normal
 * cached:no-store GET has none of that machinery: the promise settles exactly
 * when the HTTP response does. Authorisation is unchanged — the handler
 * delegates to the same audited read action, which scopes everything to
 * auth.uid().
 */
export async function GET() {
  const options = await listIvoPickerOptionsAction();
  return NextResponse.json(options, {
    headers: { "Cache-Control": "no-store" },
  });
}
