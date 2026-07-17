"use server";

/**
 * User-facing management of Ivo's long-term memory (`ivo_memories`).
 * The agent writes memories through its guarded `remember` tool; here the
 * user can review and delete them — full transparency and control over
 * everything the assistant retains between conversations.
 */

import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import type { IvoMemoryRow } from "@/lib/supabase/types";

export interface IvoMemoryItem {
  id: string;
  content: string;
  createdAt: string;
}

async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export async function listIvoMemoriesAction(): Promise<
  { ok: true; data: IvoMemoryItem[] } | { ok: false; error: string }
> {
  try {
    const { supabase, userId } = await requireUser();
    const { data, error } = await supabase
      .from("ivo_memories")
      .select("id, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return {
      ok: true,
      data: ((data as unknown as IvoMemoryRow[] | null) ?? []).map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
      })),
    };
  } catch (error) {
    log.warn("ivo.memories.list_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Couldn't load Ivo's memories right now." };
  }
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteIvoMemoryAction(
  input: z.input<typeof deleteSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid memory reference." };
  try {
    const { supabase, userId } = await requireUser();
    const { error } = await supabase
      .from("ivo_memories")
      .delete()
      .eq("id", parsed.data.id)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    log.warn("ivo.memories.delete_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Couldn't delete that memory right now." };
  }
}
