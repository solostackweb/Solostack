"use server";

/**
 * Contract / proposal delivery action. Mirrors the invoice flow but
 * adapted for the prose-heavy contract document. See
 * `@/features/invoices/delivery.ts` for the full pipeline rationale.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getContract } from "./server";
import { ensureContractPublicToken } from "@/features/share/server";
import { buildContractPdfData } from "@/features/documents/builders";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { ContractPdf } from "@/features/documents/pdf/contract-pdf";
import {
  buildEmailBrand,
  renderContractSentEmail,
} from "@/features/email/templates";
import { dispatchDelivery, pdfAttachment } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { resolveEmailLogoUrl } from "@/features/email/logo";
import { recordActivity } from "@/features/activity/server";
import { createNotification } from "@/features/notifications/server";
import { getContractShareUrl } from "@/features/documents/urls";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

const sendSchema = z.object({
  contractId: z.string().uuid(),
  toEmail: z.string().email().optional(),
  toName: z.string().trim().min(1).optional(),
  message: z.string().max(2000).optional(),
  ccSelf: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user;
}

export async function sendContractAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<{ token: string; logId: string | null }>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const user = await requireUser();
  const supabase = await getServerSupabase();

  const contract = await getContract(parsed.data.contractId);
  if (!contract) return { ok: false, error: "Document not found." };

  let toEmail = parsed.data.toEmail ?? null;
  let toName = parsed.data.toName ?? null;
  if (!toEmail && contract.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("email, full_name")
      .eq("id", contract.clientId)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    toEmail = c?.email ?? toEmail;
    toName = toName ?? c?.full_name ?? null;
  }
  if (!toEmail) {
    return {
      ok: false,
      error: "No recipient email — add one on the client record or pass it explicitly.",
    };
  }

  const token = await ensureContractPublicToken(contract.id);
  if (!token) return { ok: false, error: "Could not create share link." };

  const pdfData = await buildContractPdfData(contract.id);
  if (!pdfData) return { ok: false, error: "Could not render document." };
  const pdfBuffer = await renderPdfToBuffer(ContractPdf({ data: pdfData }));

  const { data: profile } = await supabase
    .from("user_profiles")
    .select(
      "business_name, legal_name, full_name, email, brand_color, logo_url, business_email, business_phone, website",
    )
    .eq("id", user.id)
    .maybeSingle();
  const p = profile as
    | {
        business_name?: string | null;
        legal_name?: string | null;
        full_name?: string | null;
        email?: string | null;
        brand_color?: string | null;
        logo_url?: string | null;
        business_email?: string | null;
        business_phone?: string | null;
        website?: string | null;
      }
    | null;
  const senderName =
    p?.business_name ?? p?.legal_name ?? p?.full_name ?? "Stackivo";

  // Email gets a signed https URL, never the PDF's base64 data URL — mail
  // clients strip `data:` images and filters penalise the bulk. See
  // features/email/logo.ts.
  const emailBrand = buildEmailBrand({
    businessName: p?.business_name ?? null,
    legalName: p?.legal_name ?? null,
    fullName: p?.full_name ?? null,
    brandColor: p?.brand_color ?? null,
    logoUrl: await resolveEmailLogoUrl(p?.logo_url, supabase),
    businessEmail: p?.business_email ?? null,
    businessPhone: p?.business_phone ?? null,
    email: p?.email ?? null,
    website: p?.website ?? null,
  });

  await supabase
    .from("contracts")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      public_token: token,
    } as never)
    .eq("id", contract.id);

  const kindLabel: "Contract" | "Proposal" =
    contract.kind === "proposal" ? "Proposal" : "Contract";
  const publicUrl = getContractShareUrl(token);
  const rendered = renderContractSentEmail({
    kindLabel,
    title: contract.title,
    clientName: toName ?? "there",
    senderName,
    senderEmail: getEmailSender("share").email,
    message: parsed.data.message ?? null,
    publicUrl,
    brand: emailBrand,
  });

  const slug = contract.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const dispatch = await dispatchDelivery({
    userId: user.id,
    kind: contract.kind === "proposal" ? "proposal_sent" : "contract_sent",
    entityType: "contract",
    senderType: "share",
    entityId: contract.id,
    to: { email: toEmail, name: toName ?? undefined },
    cc:
      parsed.data.ccSelf && p?.email
        ? [{ email: p.email, name: senderName }]
        : undefined,
    replyTo: p?.email ? { email: p.email, name: senderName } : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: [
      pdfAttachment(
        `${contract.kind}-${slug || contract.kind}.pdf`,
        pdfBuffer,
      ),
    ],
    metadata: { contractId: contract.id, kind: contract.kind },
    tags: [contract.kind === "proposal" ? "proposal_sent" : "contract_sent", "share"],
    idempotencyKey: parsed.data.idempotencyKey
      ? `contract-email:${user.id}:${parsed.data.idempotencyKey}`
      : null,
  });

  await recordActivity({
    kind: contract.kind === "proposal" ? "proposal_sent" : "contract_sent",
    entityType: "contract",
    entityId: contract.id,
    title: `${kindLabel} sent: ${contract.title}`,
    metadata: { to: toEmail, ok: dispatch.ok },
  });

  await createNotification({
    type: contract.kind === "proposal" ? "proposal_sent" : "contract_sent",
    title: `${kindLabel} sent: ${contract.title}`,
    message: dispatch.ok
      ? `Delivered to ${toEmail}.`
      : `Could not email ${toEmail}: ${dispatch.error}`,
  });

  revalidatePath("/dashboard/contracts");
  revalidatePath(`/dashboard/contracts/${contract.id}`);

  if (!dispatch.ok) {
    return {
      ok: false,
      error: `Email failed: ${dispatch.error}. The share link is still active.`,
    };
  }
  return {
    ok: true,
    data: { token, logId: dispatch.logId },
    message: `${kindLabel} sent.`,
  };
}
