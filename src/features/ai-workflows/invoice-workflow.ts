import "server-only";

import { getClientDisplayName } from "@/features/clients/utils";
import type { ClientRecord } from "@/features/clients/server";
import type { ProjectRecord } from "@/features/projects/server";
import { aiInvoiceDraftSchema, type AiInvoiceDraft, type AiInvoiceRequest } from "./types";
import { generateStructuredJson } from "./groq";

function money(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

function buildLocalDraft(input: AiInvoiceRequest): AiInvoiceDraft {
  const quantity = money(input.quantity, 1) || 1;
  const rate = money(input.amount, 0);

  return {
    items: [
      {
        description: input.workDescription.trim().slice(0, 200),
        quantity,
        rate,
      },
    ],
    notes: input.notes?.trim() || "",
    terms: input.dueDate
      ? `Payment due on ${input.dueDate}.`
      : "Payment due as per the invoice due date.",
  };
}

export async function draftInvoiceWithAi({
  input,
  client,
  project,
  defaultTerms,
}: {
  input: AiInvoiceRequest;
  client: ClientRecord;
  project: ProjectRecord | null;
  defaultTerms?: string | null;
}): Promise<{ draft: AiInvoiceDraft; provider: "groq" | "local" }> {
  const localDraft = buildLocalDraft(input);

  const aiJson = await generateStructuredJson({
    operation: "invoice_draft",
    messages: [
      {
        role: "system",
        content: [
          "You generate Stackivo invoice drafts for freelancers and agencies.",
          "Return only JSON matching this shape:",
          '{"items":[{"description":"string","quantity":number,"rate":number}],"notes":"string","terms":"string"}',
          "Do not calculate tax, invoice numbers, totals, discounts, payment state, or send anything.",
          "Respect the client's billing context: domestic Indian clients invoice in INR and may have GST; foreign clients invoice in their configured currency and are export/zero-rated with no GST calculation here.",
          "CRITICAL: the line item description MUST be based on the user's own workDescription (userInput.workDescription). Use it as written, lightly cleaned up — do NOT replace it with the project name, client name, or a generic phrase. The project/client are context only, never the description.",
          "Keep line descriptions professional and under 200 characters.",
          "Use the supplied amount as the rate unless the user clearly described multiple line items.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          workflow: "invoice_generation",
          client: {
            name: getClientDisplayName(client),
            businessName: client.businessName,
            email: client.email,
            gstRegistered: client.gstRegistered,
            country: client.country,
            currency: client.currency,
            isForeign: client.isForeign,
          },
          project: project
            ? {
                name: project.name,
                description: project.description,
                status: project.status,
              }
            : null,
          userInput: input,
          defaults: {
            terms: defaultTerms,
            localDraft,
          },
        }),
      },
    ],
  }).catch(() => null);

  const parsed = aiInvoiceDraftSchema.safeParse(aiJson);
  if (!parsed.success) {
    return { draft: localDraft, provider: "local" };
  }

  return { draft: parsed.data, provider: "groq" };
}
