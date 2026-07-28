"use server";

/**
 * Reads Ivo's execution receipts for the signed-in user.
 *
 * Read-only and user-scoped. Every row is filtered by `user_id` in addition to
 * RLS, so a receipt for another workspace cannot be returned even if a policy
 * were later relaxed by mistake.
 */

import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildIvoReceipt, type IvoExecutionReceipt, type IvoLedgerRow } from "./receipts";

const listSchema = z.object({
  /** Restrict to one conversation, or omit for the whole workspace history. */
  conversationId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export async function listIvoReceiptsAction(
  input: z.input<typeof listSchema> = {},
): Promise<
  | { ok: true; data: { receipts: IvoExecutionReceipt[]; asOf: string } }
  | { ok: false; error: string }
> {
  const parsed = listSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid receipt request." };

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not signed in." };

    let query = supabase
      .from("ivo_action_attempts")
      .select("id, tool_key, entity_id, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(parsed.data.limit);
    if (parsed.data.conversationId) {
      query = query.eq("conversation_id", parsed.data.conversationId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const receipts = ((data as IvoLedgerRow[] | null) ?? [])
      .map(buildIvoReceipt)
      // A row referencing a tool that is no longer declared is dropped rather
      // than shown with invented metadata.
      .filter((receipt): receipt is IvoExecutionReceipt => receipt !== null);

    return { ok: true, data: { receipts, asOf: new Date().toISOString() } };
  } catch (error) {
    log.warn("ivo.receipts.read_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    // Distinguishable from "no receipts": the caller must not render an empty
    // audit trail when the read failed.
    return { ok: false, error: "Ivo couldn't read your activity just now." };
  }
}
