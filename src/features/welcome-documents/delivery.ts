"use server";

/**
 * Welcome Document delivery — sends the onboarding guide to a client
 * by email, with the rendered PDF attached.
 *
 * Mirrors `@/features/contracts/delivery.ts` (and ultimately
 * `@/features/invoices/delivery.ts`) so the lifecycle is identical:
 *   1. Guard auth + load the document
 *   2. Resolve a recipient (explicit override OR linked client.email)
 *   3. Mint a public token
 *   4. Render the PDF + email body
 *   5. Flip status to `published` and stamp `sent_at`
 *   6. Dispatch via the shared delivery pipeline (idempotent + suppression-aware)
 *   7. Record activity + notification regardless of dispatch outcome
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getWelcomeDocument, ensureWelcomePublicToken } from "./server";
import { buildWelcomeDocumentPdfData } from "@/features/documents/builders";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { WelcomeDocumentPdf } from "@/features/documents/pdf/welcome-document-pdf";
import {
  buildEmailBrand,
  renderWelcomeDocumentEmail,
} from "@/features/email/templates";
import { dispatchDelivery, pdfAttachment } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { resolveEmailLogoUrl } from "@/features/email/logo";
import { recordActivity } from "@/features/activity/server";
import { createNotification } from "@/features/notifications/server";
import { getWelcomeShareUrl, welcomeDocumentDetail } from "./routes";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

const sendSchema = z.object({
  documentId: z.string().uuid(),
  /** Override recipient — defaults to the linked client's email. */
  toEmail: z.string().email().optional(),
  toName: z.string().trim().min(1).optional(),
  /** Optional personal note appended to the email body. */
  message: z.string().max(2000).optional(),
  /** Send a copy to the freelancer's own profile email. */
  ccSelf: z.boolean().optional(),
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export async function sendWelcomeDocumentAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<{ token: string; logId: string | null }>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);

  const doc = await getWelcomeDocument(parsed.data.documentId);
  if (!doc) return { ok: false, error: "Document not found." };

  // ---- One-per-client guard -----------------------------------------------
  // A freelancer should only have one active sent welcome document per
  // client. If another non-deleted, non-archived document was already sent
  // to the same client, block this send and ask the user to delete it first.
  if (doc.clientId) {
    const { data: conflict } = await supabase
      .from("welcome_documents")
      .select("id, title")
      .eq("user_id", user.id)
      .eq("client_id", doc.clientId)
      .is("deleted_at", null)
      .neq("status", "archived")
      .not("sent_at", "is", null)
      .neq("id", doc.id)
      .maybeSingle();

    if (conflict) {
      const c = conflict as { id: string; title: string };
      return {
        ok: false,
        error: `This client already has an active welcome document: "${c.title}". Delete or archive it first before sending a new one.`,
      };
    }
  }

  // ---- Recipient resolution -----------------------------------------------
  let toEmail = parsed.data.toEmail ?? null;
  let toName = parsed.data.toName ?? null;
  if (!toEmail && doc.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("email, full_name")
      .eq("id", doc.clientId)
      .maybeSingle();
    const c = client as
      | { email?: string | null; full_name?: string | null }
      | null;
    toEmail = c?.email ?? toEmail;
    toName = toName ?? c?.full_name ?? null;
  }
  if (!toEmail) {
    return {
      ok: false,
      error:
        "No recipient email — add one on the client record or pass it explicitly.",
    };
  }

  // ---- Share link + PDF ---------------------------------------------------
  const token = await ensureWelcomePublicToken(doc.id);
  if (!token) return { ok: false, error: "Could not create share link." };

  const pdfData = await buildWelcomeDocumentPdfData(doc.id);
  if (!pdfData) return { ok: false, error: "Could not render document." };
  const pdfBuffer = await renderPdfToBuffer(WelcomeDocumentPdf({ data: pdfData }));

  // ---- Sender details for the envelope ------------------------------------
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
  const emailBrand = buildEmailBrand({
    businessName: p?.business_name ?? null,
    legalName: p?.legal_name ?? null,
    fullName: p?.full_name ?? null,
    brandColor: doc.brandColor ?? p?.brand_color ?? null,
    logoUrl: await resolveEmailLogoUrl(p?.logo_url, supabase),
    businessEmail: p?.business_email ?? null,
    businessPhone: p?.business_phone ?? null,
    email: p?.email ?? null,
    website: p?.website ?? null,
  });

  // ---- Flip status to published + stamp sent_at ---------------------------
  await supabase
    .from("welcome_documents")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      public_token: token,
    } as never)
    .eq("id", doc.id);

  // ---- Render email -------------------------------------------------------
  const publicUrl = getWelcomeShareUrl(token);
  const rendered = renderWelcomeDocumentEmail({
    title: doc.title,
    clientName: toName ?? "there",
    senderName,
    senderEmail: getEmailSender("share").email,
    message: parsed.data.message ?? null,
    publicUrl,
    brand: emailBrand,
  });

  const slug = doc.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const dispatch = await dispatchDelivery({
    userId: user.id,
    kind: "welcome_document_sent",
    entityType: "welcome_document",
    senderType: "share",
    entityId: doc.id,
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
      pdfAttachment(`welcome-${slug || "guide"}.pdf`, pdfBuffer),
    ],
    metadata: { documentId: doc.id },
    tags: ["welcome_document_sent", "share"],
    idempotencyKey: parsed.data.idempotencyKey
      ? `welcome-email:${user.id}:${parsed.data.idempotencyKey}`
      : null,
  });

  await recordActivity({
    kind: "welcome_document_sent",
    entityType: "welcome_document",
    entityId: doc.id,
    title: `Welcome guide sent: ${doc.title}`,
    metadata: { to: toEmail, ok: dispatch.ok },
  });

  await createNotification({
    type: "welcome_document_sent",
    title: `Welcome guide sent: ${doc.title}`,
    message: dispatch.ok
      ? `Delivered to ${toEmail}.`
      : `Could not email ${toEmail}: ${dispatch.error}`,
  });

  revalidatePath("/dashboard/welcome");
  revalidatePath(welcomeDocumentDetail(doc.id));

  if (!dispatch.ok) {
    return {
      ok: false,
      error: `Email failed: ${dispatch.error}. The share link is still active at ${publicUrl}.`,
    };
  }
  return {
    ok: true,
    data: { token, logId: dispatch.logId },
    message: "Welcome guide sent.",
  };
}
