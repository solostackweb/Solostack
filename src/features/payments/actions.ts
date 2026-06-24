"use server";

/**
 * Freelancer payment-connection CRUD. RLS-scoped to the owner via the user
 * Supabase client (the table's owner_all policy enforces auth.uid() = user_id).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProvider, isPayUrl } from "./providers";

export interface PaymentConnectionResult {
  ok: boolean;
  error?: string;
}

const SETTINGS_PATH = "/dashboard/settings/payments";

const connectionSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  label: z.string().trim().max(60).optional().or(z.literal("")),
  kind: z.enum(["link", "handle"]),
  value: z.string().trim().min(1, "Enter the link or details").max(500),
  instructions: z.string().trim().max(500).optional().or(z.literal("")),
  isDefault: z.boolean().optional(),
});

async function requireUserId(): Promise<string | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function addPaymentConnectionAction(
  input: z.infer<typeof connectionSchema>,
): Promise<PaymentConnectionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const parsed = connectionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;
  if (!getProvider(data.provider)) {
    return { ok: false, error: "Unknown payment platform." };
  }
  if (data.kind === "link" && !isPayUrl(data.value)) {
    return { ok: false, error: "Enter a valid https:// payment link." };
  }

  const supabase = await getServerSupabase();

  // If this is the first connection, make it default automatically.
  const { count } = await supabase
    .from("payment_connections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const makeDefault = data.isDefault || (count ?? 0) === 0;

  if (makeDefault) {
    await supabase
      .from("payment_connections")
      .update({ is_default: false } as never)
      .eq("user_id", userId);
  }

  const { error } = await supabase.from("payment_connections").insert({
    user_id: userId,
    provider: data.provider,
    label: data.label || getProvider(data.provider)?.name || data.provider,
    kind: data.kind,
    value: data.value,
    instructions: data.instructions || null,
    is_default: makeDefault,
    status: "active",
  } as never);
  if (error) return { ok: false, error: "Could not save. Please try again." };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

export async function deletePaymentConnectionAction(
  id: string,
): Promise<PaymentConnectionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("payment_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not remove. Please try again." };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}

export async function setDefaultPaymentConnectionAction(
  id: string,
): Promise<PaymentConnectionResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "You are not signed in." };

  const supabase = await getServerSupabase();
  await supabase
    .from("payment_connections")
    .update({ is_default: false } as never)
    .eq("user_id", userId);
  const { error } = await supabase
    .from("payment_connections")
    .update({ is_default: true } as never)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Could not update. Please try again." };

  revalidatePath(SETTINGS_PATH);
  return { ok: true };
}
