"use server";

/**
 * Inline AI for the invoice builder — drafts the client-visible Notes and
 * Terms fields from the invoice's own context (client, items, amounts, due
 * date). Same guarded pattern as the proposal assist: auth + rate limit +
 * grounded prompt, nothing invented.
 */

import { z } from "zod";

import { log } from "@/lib/logger";
import { getServerSupabase } from "@/lib/supabase/server";
import { aiGenerateLimit } from "@/lib/rate-limit";
import { generateStructuredJson } from "@/features/ai-workflows/groq";

const FIELDS = ["notes", "terms"] as const;
type InvoiceAiField = (typeof FIELDS)[number];

const inputSchema = z.object({
  field: z.enum(FIELDS),
  clientName: z.string().max(200).optional(),
  currency: z.string().max(10).default("INR"),
  items: z.array(z.string().max(500)).max(25).default([]),
  total: z.number().nonnegative().optional(),
  dueDate: z.string().max(30).optional(),
  isExport: z.boolean().default(false),
});

const FIELD_BRIEF: Record<InvoiceAiField, string> = {
  notes:
    "Write the client-visible NOTES for this invoice: 1-3 warm, professional sentences — thank the client, reference the work naturally, and make paying feel easy. No pressure, no legalese.",
  terms:
    "Write the invoice TERMS: 2-4 short lines covering payment due timing, accepted reference (invoice number), a gentle late-payment line, and — for export invoices — a zero-rated/export note. Plain language, protective without being hostile.",
};

export async function draftInvoiceFieldAction(
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

    const { field, clientName, currency, items, total, dueDate, isExport } = parsed.data;
    const result = await generateStructuredJson({
      operation: "invoice_field_draft",
      temperature: 0.5,
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content: [
            "You draft one small section of an invoice for an Indian independent professional. Ground everything in the provided context; never invent amounts, dates, or fees beyond it.",
            FIELD_BRIEF[field],
            `Currency: ${currency}.${isExport ? " This is an export (zero-rated) invoice." : ""} Plain text only.`,
            'Return ONLY JSON: {"text":"..."}',
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            client: clientName ?? "the client",
            lineItems: items,
            total,
            dueDate: dueDate ?? "as configured",
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
    return { ok: true, text: text.slice(0, 2000) };
  } catch (error) {
    log.warn("invoice.ai_assist_failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, error: "Ivo couldn't draft that right now — try again in a moment." };
  }
}
