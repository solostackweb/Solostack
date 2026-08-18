"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getServerSupabase } from "@/lib/supabase/server";
import { getGmailSendAsState } from "@/features/email/gmail-sender";

export type IntegrationActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const toggleSchema = z.object({ enabled: z.boolean() });

/**
 * Turn Gmail send-as on or off for the signed-in freelancer.
 *
 * Refuses to turn on when the stored Google grant predates the gmail.send
 * scope — flipping the switch would look like it worked while every send
 * quietly kept going through Brevo.
 */
export async function setGmailSendAsAction(
  input: z.infer<typeof toggleSchema>,
): Promise<IntegrationActionResult> {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const state = await getGmailSendAsState(user.id);
  if (!state.connected) {
    return { ok: false, error: "Connect Google first." };
  }
  if (parsed.data.enabled && !state.scopeGranted) {
    return {
      ok: false,
      error:
        "Your Google connection was made before email sending was supported. Reconnect Google to enable this.",
    };
  }

  const { error } = await supabase
    .from("calendar_connections")
    .update({
      send_as_gmail: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/integrations");
  return {
    ok: true,
    message: parsed.data.enabled
      ? `Client documents will now send from ${state.email ?? "your Gmail address"}.`
      : "Client documents will send from Stackivo's address again.",
  };
}
