"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getInvoice } from "./server";
import {
  buildInvoicePdfData,
  buildInvoicePdfDataByToken,
  buildReceiptPdfDataByToken,
} from "@/features/documents/builders";
import { renderPdfToBuffer } from "@/features/documents/pdf/render";
import { InvoicePdf } from "@/features/documents/pdf/invoice-pdf";
import { ReceiptPdf } from "@/features/documents/pdf/receipt-pdf";
import {
  buildEmailBrand,
  renderInvoicePaidEmail,
  renderInvoiceSentEmail,
} from "@/features/email/templates";
import { ensureInvoicePublicToken } from "@/features/share/server";
import { env } from "@/config/env";
import { dispatchDelivery, pdfAttachment } from "@/features/email/send";
import { getEmailSender } from "@/features/email/senders";
import { resolveEmailLogoUrl } from "@/features/email/logo";
import { recordActivity } from "@/features/activity/server";
import { createNotification } from "@/features/notifications/server";
import { formatCurrencyAmount } from "@/lib/format";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string };

const sendSchema = z.object({
  invoiceId: z.string().uuid(),
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

/**
 * Send an invoice to the client as DUE (status -> 'sent', NOT 'paid').
 *
 * The client receives an email with the invoice PDF attached and a link
 * to the public payment page (/i/<token>) where they can pay via Razorpay.
 * The invoice is marked `paid` only when the payment webhook fires (see
 * `markInvoicePaidFromWebhook`).
 */
export async function sendInvoiceAction(
  input: z.input<typeof sendSchema>,
): Promise<ActionResult<{ logId: string | null }>> {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const user = await requireUser();
  const supabase = await getServerSupabase();
  const record = await getInvoice(parsed.data.invoiceId);
  if (!record) return { ok: false, error: "Invoice not found." };

  let toEmail = parsed.data.toEmail ?? null;
  let toName = parsed.data.toName ?? null;
  if (!toEmail && record.invoice.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("email, full_name")
      .eq("id", record.invoice.clientId)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    toEmail = c?.email ?? toEmail;
    toName = toName ?? c?.full_name ?? null;
  }
  if (!toEmail) {
    return {
      ok: false,
      error: "No recipient email. Add an email to the client before sending.",
    };
  }

  const pdfData = await buildInvoicePdfData(record.invoice.id);
  if (!pdfData) return { ok: false, error: "Could not render invoice." };
  const pdfBuffer = await renderPdfToBuffer(InvoicePdf({ data: pdfData }));

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
    brandColor: pdfData.brandColor,
    logoUrl: await resolveEmailLogoUrl(p?.logo_url, supabase),
    businessEmail: p?.business_email ?? null,
    businessPhone: p?.business_phone ?? null,
    email: p?.email ?? null,
    website: p?.website ?? null,
  });

  const invoiceTotal = resolveInvoiceTotal(pdfData);
  const amountFormatted = formatCurrency(invoiceTotal, record.invoice.currency);

  // Make sure the invoice has a public token before we link to /i/<token>.
  const publicToken = await ensureInvoicePublicToken(record.invoice.id);
  const publicUrl = publicToken
    ? `${env.appUrl.replace(/\/$/, "")}/i/${publicToken}`
    : `${env.appUrl.replace(/\/$/, "")}/dashboard/invoices/${record.invoice.id}`;

  const rendered = renderInvoiceSentEmail({
    invoiceNumber: record.invoice.invoiceNumber,
    amountFormatted,
    dueDate: record.invoice.dueDate,
    clientName: toName ?? "there",
    senderName,
    senderEmail: getEmailSender("billing").email,
    message: parsed.data.message ?? null,
    publicUrl,
    brand: emailBrand,
  });

  const dispatch = await dispatchDelivery({
    userId: user.id,
    kind: "invoice_sent",
    entityType: "invoice",
    senderType: "billing",
    entityId: record.invoice.id,
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
      pdfAttachment(`invoice-${record.invoice.invoiceNumber}.pdf`, pdfBuffer),
    ],
    metadata: {
      invoiceId: record.invoice.id,
      total: invoiceTotal,
      currency: record.invoice.currency,
      publicUrl,
    },
    tags: ["invoice_sent", "billing"],
    idempotencyKey: parsed.data.idempotencyKey
      ? `invoice-email:${user.id}:${parsed.data.idempotencyKey}`
      : null,
  });

  // Mark the invoice as issued ('sent') regardless of whether the *email*
  // delivery succeeded. Issuance is the freelancer's intent — email is just
  // one delivery channel (they may also share the link / WhatsApp). Coupling
  // status to email success left invoices stuck on "draft" (and the PDF
  // showing DRAFT) whenever email wasn't configured. We never downgrade a
  // paid invoice, and we keep a 'viewed' invoice as 'viewed'.
  if (record.invoice.status !== "paid") {
    await supabase
      .from("invoices")
      .update({
        status: record.invoice.status === "viewed" ? "viewed" : "sent",
        sent_at: new Date().toISOString(),
      } as never)
      .eq("id", record.invoice.id);
  }

  await recordActivity({
    kind: dispatch.ok ? "invoice_sent" : "invoice_delivery_failed",
    entityType: "invoice",
    entityId: record.invoice.id,
    title: dispatch.ok
      ? `Invoice ${record.invoice.invoiceNumber} sent to ${toEmail}`
      : `Invoice ${record.invoice.invoiceNumber} email failed`,
    metadata: {
      to: toEmail,
      total: invoiceTotal,
      currency: record.invoice.currency,
      ok: dispatch.ok,
      error: dispatch.ok ? null : dispatch.error,
    },
  });

  await createNotification({
    type: dispatch.ok ? "invoice_sent" : "invoice_delivery_failed",
    title: dispatch.ok
      ? `Invoice ${record.invoice.invoiceNumber} sent`
      : `Invoice ${record.invoice.invoiceNumber} email not sent`,
    message: dispatch.ok
      ? `PDF delivered to ${toEmail}. Awaiting payment.`
      : "Email is not configured. The invoice was saved but not emailed.",
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${record.invoice.id}`);

  if (!dispatch.ok) {
    return {
      ok: false,
      error: `Email failed: ${dispatch.error}. The invoice was saved.`,
    };
  }

  return {
    ok: true,
    data: { logId: dispatch.logId },
    message: "Invoice emailed to client.",
  };
}

/**
 * Send a thank-you receipt email to the client AFTER a payment has been
 * captured. Called from the Razorpay invoice-payment webhook handler.
 *
 * Idempotency: the underlying `dispatchDelivery` is keyed on
 * `idempotencyKey` so concurrent webhook retries cannot duplicate the
 * receipt.
 */
export async function sendInvoiceReceiptAction(input: {
  invoiceId: string;
  toEmail: string;
  toName?: string | null;
}): Promise<ActionResult<{ logId: string | null }>> {
  // Use the admin client throughout — this action is called from both
  // authenticated paths AND the anonymous post-payment verify flow, where
  // there's no user session. Admin reads bypass RLS safely; we never let
  // user input into table writes here.
  const admin = getAdminSupabase();

  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("id, user_id, public_token, invoice_number, currency, total_amount")
    .eq("id", input.invoiceId)
    .maybeSingle();
  const invoice = invoiceRow as
    | {
        id: string;
        user_id: string | null;
        public_token: string | null;
        invoice_number: string;
        currency: string;
        total_amount: number;
      }
    | null;
  if (!invoice || !invoice.user_id || !invoice.public_token) {
    return { ok: false, error: "Invoice not found or not shareable." };
  }

  const pdfData = await buildInvoicePdfDataByToken(invoice.public_token);
  if (!pdfData) return { ok: false, error: "Could not render invoice." };
  const pdfBuffer = await renderPdfToBuffer(InvoicePdf({ data: pdfData }));

  // Prefer the new receipt PDF (when one exists for this invoice). If the
  // payment is logged but the receipt row was never written for some
  // reason, we fall back to attaching the invoice PDF with a "paid" stamp.
  const receiptData = await buildReceiptPdfDataByToken(invoice.public_token);
  const receiptPdfBuffer = receiptData
    ? await renderPdfToBuffer(ReceiptPdf({ data: receiptData }))
    : null;

  const { data: profile } = await admin
    .from("user_profiles")
    .select(
      "business_name, legal_name, full_name, email, brand_color, logo_url, business_email, business_phone, website",
    )
    .eq("id", invoice.user_id)
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
    brandColor: pdfData.brandColor,
    logoUrl: await resolveEmailLogoUrl(p?.logo_url, admin),
    businessEmail: p?.business_email ?? null,
    businessPhone: p?.business_phone ?? null,
    email: p?.email ?? null,
    website: p?.website ?? null,
  });

  const invoiceTotal = Number(invoice.total_amount) || 0;
  const amountFormatted = formatCurrency(invoiceTotal, invoice.currency);

  const rendered = renderInvoicePaidEmail({
    invoiceNumber: invoice.invoice_number,
    amountFormatted,
    clientName: input.toName ?? "there",
    senderName,
    senderEmail: getEmailSender("billing").email,
    receiptNumber: receiptData?.receiptNumber,
    paymentMethod:
      receiptData?.paymentMethod === "stackivo_managed"
        ? "Razorpay Checkout"
        : receiptData?.paymentMethod === "upi_smart"
          ? "UPI (Smart Collect)"
          : receiptData?.paymentMethod === "upi_manual"
            ? "UPI"
            : receiptData?.paymentMethod,
    paidAtFormatted: receiptData
      ? new Date(receiptData.paidAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : undefined,
    reference: receiptData?.reference ?? undefined,
    brand: emailBrand,
  });

  const dispatch = await dispatchDelivery({
    userId: invoice.user_id,
    kind: "invoice_paid",
    entityType: "invoice",
    senderType: "billing",
    entityId: invoice.id,
    to: { email: input.toEmail, name: input.toName ?? undefined },
    replyTo: p?.email ? { email: p.email, name: senderName } : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: receiptPdfBuffer && receiptData
      ? [
          pdfAttachment(
            `receipt-${receiptData.receiptNumber}.pdf`,
            receiptPdfBuffer,
          ),
          pdfAttachment(`invoice-${invoice.invoice_number}.pdf`, pdfBuffer),
        ]
      : [pdfAttachment(`invoice-${invoice.invoice_number}.pdf`, pdfBuffer)],
    metadata: { invoiceId: invoice.id, receipt: true },
    tags: ["invoice_receipt", "billing"],
    idempotencyKey: `invoice-receipt:${invoice.id}`,
  });

  if (!dispatch.ok) {
    return {
      ok: false,
      error: `Receipt email failed: ${dispatch.error}.`,
    };
  }
  return {
    ok: true,
    data: { logId: dispatch.logId },
    message: "Receipt emailed.",
  };
}

function resolveInvoiceTotal(
  data: NonNullable<Awaited<ReturnType<typeof buildInvoicePdfData>>>,
): number {
  const lineSubtotal = data.items.reduce((sum, item) => sum + safeNumber(item.amount), 0);
  const lineTax = computeLineTax(data);
  const tax =
    positiveOrFallback(data.cgstAmount, lineTax.cgst) +
    positiveOrFallback(data.sgstAmount, lineTax.sgst) +
    positiveOrFallback(data.igstAmount, lineTax.igst);
  const fallback = roundMoney(lineSubtotal + tax);
  const total = safeNumber(data.totalAmount);
  return total > 0 ? total : fallback;
}

function computeLineTax(
  data: NonNullable<Awaited<ReturnType<typeof buildInvoicePdfData>>>,
) {
  if (data.taxMode === "non_gst") return { cgst: 0, sgst: 0, igst: 0 };
  return data.items.reduce(
    (sum, item) => {
      const amount = safeNumber(item.amount);
      const rate = safeNumber(item.gstRate);
      if (data.taxMode === "igst") {
        sum.igst += roundMoney((amount * rate) / 100);
      } else {
        const half = roundMoney((amount * rate) / 200);
        sum.cgst += half;
        sum.sgst += half;
      }
      return sum;
    },
    { cgst: 0, sgst: 0, igst: 0 },
  );
}

function positiveOrFallback(value: number | null | undefined, fallback: number): number {
  const n = safeNumber(value);
  return n > 0 ? n : fallback;
}

function safeNumber(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value: number, currency: string): string {
  return formatCurrencyAmount(value, currency);
}
