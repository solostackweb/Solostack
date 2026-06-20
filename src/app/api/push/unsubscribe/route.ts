/**
 *   POST /api/push/unsubscribe
 *
 * Removes a Web Push subscription (by endpoint) for the signed-in user.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { pushSubscribeLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ endpoint: z.string().url().max(2000) });

export async function POST(req: Request): Promise<Response> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }

  const rl = await pushSubscribeLimit(`push:${user.id}`);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: rl.message }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input." }, { status: 400 });
  }

  const admin = getAdminSupabase();
  await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
