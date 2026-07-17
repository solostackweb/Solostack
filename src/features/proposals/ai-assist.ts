"use server";

/**
 * Inline AI for the proposal builder — field-level drafting without leaving
 * the editor. Each call grounds the draft in what the user already entered
 * (title, client, line items, sibling fields) so generated copy is specific,
 * never boilerplate.
 */

import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import { aiGenerateLimit } from "@/lib/rate-limit";
import { generateStructuredJson } from "@/features/ai-workflows/groq";

const FIELDS = ["scope", "deliverables", "timeline", "terms"] as const;
type ProposalAiField = (typeof FIELDS)[number];

const inputSchema = z.object({
  field: z.enum(FIELDS),
  title: z.string().max(300).default(""),
  clientName: z.string().max(200).optional(),
  currency: z.string().max(10).default("INR"),
  items: z.array(z.string().max(500)).max(25).default([]),
  context: z
    .object({
      scope: z.string().max(4000).optional(),
      deliverables: z.string().max(4000).optional(),
      timeline: z.string().max(4000).optional(),
      terms: z.string().max(4000).optional(),
    })
    .default({}),
});

const FIELD_BRIEF: Record<ProposalAiField, string> = {
  scope:
    "Write the SCOPE section: what this engagement covers, in 3-6 crisp sentences or short bullets ('- ' prefix). Specific to the line items and title — no generic filler.",
  deliverables:
    "Write the DELIVERABLES section as a tight bullet list ('- ' prefix, 4-8 bullets) of concrete things the client receives. Derive them from the line items and scope.",
  timeline:
    "Write the TIMELINE section: realistic phases with durations (e.g. '- Week 1: discovery & wireframes'). 3-5 lines, matched to the scope's size.",
  terms:
    "Write the COMMERCIAL TERMS section: payment split (default 50% upfront / 50% on delivery unless context suggests otherwise), revision rounds (default 2), validity, and what's excluded. 3-5 lines, plain language, protective of the freelancer without being hostile.",
};

export async function draftProposalFieldAction(
  input: z.input<typeof inputSchema>,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid drafting request." };

  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };

    const rate = await aiGenerateLimit(`aigen:${user.id}`);
    if (!rate.ok) return { ok: false, error: rate.message };

    const { field, title, clientName, currency, items, context } = parsed.data;
    const result = await generateStructuredJson({
      operation: "proposal_field_draft",
      temperature: 0.5,
      maxTokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "You draft one section of a freelance proposal for an Indian independent professional. Ground everything in the provided context; never invent prices, dates, or commitments beyond it.",
            FIELD_BRIEF[field],
            `Currency: ${currency}. Plain text only (bullets as '- ').`,
            'Return ONLY JSON: {"text":"..."}',
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            proposalTitle: title || "Untitled proposal",
            client: clientName ?? "not selected yet",
            lineItems: items,
            otherSections: context,
          }),
        },
      ],
    }).catch(() => null);

    const text =
      result && typeof result === "object" && typeof (result as { text?: unknown }).text === "string"
        ? ((result as { text: string }).text || "").trim()
        : "";
    if (!text) {
      return { ok: false, error: "Ivo couldn't draft that right now — try again in a moment." };
    }
    return { ok: true, text: text.slice(0, 4000) };
  } catch (error) {
    log.warn("proposal.ai_assist_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Ivo couldn't draft that right now — try again in a moment." };
  }
}
