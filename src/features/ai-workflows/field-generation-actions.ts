"use server";

/**
 * The single endpoint behind every smart field.
 *
 * Read-and-draft only: it never writes to a workspace record. The most it can
 * do is return text for the user to review, which is what keeps this surface
 * outside the tool registry's approval machinery — nothing here can send,
 * publish, or change money. If a future field operation needs to persist, it
 * belongs in `tool-actions.ts` behind the policy gate, not here.
 */

import { redirect } from "next/navigation";

import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { aiGenerateLimit } from "@/lib/rate-limit";
import { getServerSupabase } from "@/lib/supabase/server";
import { getProfile } from "@/features/profile/server";
import { generateStructuredJson } from "./groq";
import {
  buildFieldInstruction,
  buildFieldProposal,
  logFieldGenerationFailure,
  validateFieldRequest,
  type IvoFieldGenerationInput,
  type IvoFieldGenerationResult,
} from "./field-generation";

async function requireUserId() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

/**
 * Derives the business's writing voice from its own brand copy.
 *
 * Deliberately reuses what the user already wrote rather than adding a "tone"
 * setting nobody fills in. Their tagline and intro are the most honest sample
 * of how they talk about their work.
 */
function brandVoiceFrom(profile: Awaited<ReturnType<typeof getProfile>>): string | null {
  const samples = [profile?.brandTagline, profile?.brandIntro]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length > 8));
  if (samples.length === 0) return null;
  return samples.join(" — ").slice(0, 600);
}

/**
 * Resolves the client and project names for grounding, when supplied.
 *
 * Ownership-filtered: an id belonging to another workspace resolves to nothing
 * rather than leaking a name into a prompt.
 */
async function workspaceContext(
  userId: string,
  clientId?: string,
  projectId?: string,
): Promise<{ clientName?: string; projectName?: string }> {
  if (!clientId && !projectId) return {};
  const supabase = await getServerSupabase();
  const [clientRow, projectRow] = await Promise.all([
    clientId
      ? supabase
          .from("clients")
          .select("full_name, business_name")
          .eq("id", clientId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    projectId
      ? supabase
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const client = clientRow.data as { full_name?: string; business_name?: string } | null;
  const project = projectRow.data as { name?: string } | null;
  return {
    ...(client ? { clientName: client.business_name || client.full_name || undefined } : {}),
    ...(project?.name ? { projectName: project.name } : {}),
  };
}

export async function generateFieldAction(
  input: IvoFieldGenerationInput,
): Promise<IvoFieldGenerationResult> {
  const validated = validateFieldRequest(input);
  if (!validated.ok) return validated;
  const data = validated.data;

  const userId = await requireUserId();
  const limit = await aiGenerateLimit(`aifield:${userId}`);
  if (!limit.ok) return { ok: false, error: limit.message };

  const [profile, context] = await Promise.all([
    getProfile(),
    workspaceContext(userId, data.clientId, data.projectId),
  ]);

  const raw = await generateStructuredJson({
    operation: `field_${data.kind}_${data.operation}`,
    temperature: 0.4,
    maxTokens: 1600,
    messages: [
      {
        role: "system",
        content: [
          buildFieldInstruction(data.kind, data.operation, brandVoiceFrom(profile)),
          'Return JSON in exactly this shape: { "text": "<the field content>" }.',
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          currentText: data.current,
          brief: data.brief ?? "",
          // Names only. No amounts, dates, or document bodies — the model must
          // not be able to restate a figure it was never asked about.
          client: context.clientName ?? "",
          project: context.projectName ?? "",
          requiredShape: { text: "string" },
        }),
      },
    ],
  }).catch(() => null);

  const text =
    raw && typeof raw === "object" && typeof (raw as { text?: unknown }).text === "string"
      ? (raw as { text: string }).text
      : null;

  const result = buildFieldProposal(data, text);
  if (!result.ok) logFieldGenerationFailure(data.kind, result.error);
  return result;
}
