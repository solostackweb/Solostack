"use server";

/**
 * Public (anonymous) server actions invoked from the `/i/<token>`
 * payment page.
 *
 * Two flows are supported here, gated on the freelancer's
 * `payment_method_type`:
 *
 *   - stackivo_managed: orders are created and signatures verified
 *     against the PLATFORM Razorpay account. Money lands in Stackivo,
 *     ops pays the freelancer out manually within 1-2 business days.
 *     On successful verify we mark the invoice paid AND generate the
 *     receipt synchronously, so the client sees confirmation immediately.
 *     The webhook (`/api/billing/razorpay/webhook`) acts as a redundant
 *     idempotent backstop.
 *
 *   - upi_manual: this path is NOT used to confirm payments — the
 *     freelancer marks the invoice paid manually from their dashboard.
 *     We expose `getInvoicePaymentContextAction` so the public page can
 *     render the correct panel (QR vs Razorpay button) without leaking
 *     internal user-ids.
 *
 * The deprecated per-user-Razorpay-secret flow is GONE. We never read
 * `decrypt_user_razorpay_secret(...)` here anymore.
 */

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { isValidPublicShareToken } from "@/features/share/server";
import { getClientIp, publicSignLimit } from "@/lib/rate-limit";
import {
  createPlatformInvoiceOrder,
  PlatformRazorpayError,
} from "@/features/billing/razorpay/platform-orders";
import { getUserPaymentMethod } from "@/features/billing/payment-methods";
import { requireServerEnv } from "@/config/env";
import { generateReceiptForInvoice } from "./receipts";
import { sendInvoiceReceiptAction } from "./delivery";
import { formatCurrencyAmount } from "@/lib/format";
import type { InvoicePaymentAttemptRow, InvoiceRow } from "@/lib/supabase/types";

export type PublicPaymentResult =
  | {
      ok: true;
      keyId: string;
      orderId: string;
      amountPaise: number;
      currency: string;
      invoiceNumber: string;
    }
  | { ok: false; error: string };

/**
 * Create a Razorpay order against the PLATFORM account for this invoice.
 * Only valid for `stackivo_managed` freelancers — UPI manual freelancers
 * never hit this path.
 *
 * Idempotency: if an outstanding `created` order exists for this invoice
 * that's still on the platform account, reuse it so a refresh of the
 * checkout modal doesn't litter Razorpay with duplicate orders.
 */
export async function createInvoicePaymentOrderAction(
  token: string,
): Promise<PublicPaymentResult> {
  if (!isValidPublicShareToken(token)) {
    return { ok: false, error: "Invalid invoice link." };
  }

  const ip = await getClientIp();
  const gate = await publicSignLimit(`pay:${ip}:${token}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();
  if (!invoiceRow) return { ok: false, error: "Invoice not found." };
  const invoice = invoiceRow as unknown as InvoiceRow;

  if (invoice.status === "paid") {
    return { ok: false, error: "This invoice has already been paid." };
  }

  const total = Number(invoice.total_amount);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "This invoice has no amount due." };
  }
  const amountPaise = Math.round(total * 100);
  const currency = invoice.currency || "INR";

  // Gate: freelancer must be on stackivo_managed.
  const method = await getUserPaymentMethod(invoice.user_id);
  if (!method || method.type !== "stackivo_managed") {
    return {
      ok: false,
      error:
        "Online card / netbanking payment isn't available for this invoice. Please use the UPI option on the invoice page.",
    };
  }

  const env = requireServerEnv();
  if (!env.razorpayKeyId) {
    return {
      ok: false,
      error: "Payments are temporarily unavailable. Please try again shortly.",
    };
  }

  // Idempotent reuse of an outstanding platform order.
  const { data: existingRow } = await admin
    .from("invoice_payment_attempts")
    .select("*")
    .eq("invoice_id", invoice.id)
    .eq("status", "created")
    .eq("payment_method", "stackivo_managed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingRow as InvoicePaymentAttemptRow | null;
  if (existing?.razorpay_order_id) {
    return {
      ok: true,
      keyId: env.razorpayKeyId,
      orderId: existing.razorpay_order_id,
      amountPaise,
      currency,
      invoiceNumber: invoice.invoice_number,
    };
  }

  let order;
  try {
    order = await createPlatformInvoiceOrder({
      amountPaise,
      currency,
      receipt: `inv_${invoice.invoice_number}`.slice(0, 40),
      notes: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        user_id: invoice.user_id,
        public_token: token,
        flow: "invoice_managed",
      },
    });
  } catch (err) {
    const message =
      err instanceof PlatformRazorpayError
        ? err.message
        : "We couldn't start the payment. Please try again.";
    await admin.from("invoice_payment_attempts").insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      amount: total,
      currency,
      status: "failed",
      payment_method: "stackivo_managed",
      payout_status: "not_applicable",
      error_description: message,
    } as never);
    return { ok: false, error: message };
  }

  await admin.from("invoice_payment_attempts").insert({
    invoice_id: invoice.id,
    user_id: invoice.user_id,
    razorpay_order_id: order.id,
    amount: total,
    currency,
    status: "created",
    payment_method: "stackivo_managed",
    payout_status: "pending",
  } as never);

  return {
    ok: true,
    keyId: env.razorpayKeyId,
    orderId: order.id,
    amountPaise,
    currency,
    invoiceNumber: invoice.invoice_number,
  };
}

export type VerifyPaymentResult =
  | { ok: true; alreadyPaid: boolean }
  | { ok: false; error: string };

/**
 * Verify a Razorpay one-off payment using the PLATFORM secret.
 *
 * On success we:
 *   - Upsert the payment attempt as `captured`, leave `payout_status` as
 *     `pending` so the ops team's payout dashboard sees it.
 *   - Flip the invoice to `paid` + stamp payment metadata.
 *   - Generate the receipt row (idempotent — keyed on payment_id).
 *   - Fire the receipt email to the client.
 *
 * The webhook handles the same state transition idempotently; this path
 * exists so the payer gets immediate confirmation in the UI.
 */
export async function verifyInvoicePaymentAction(input: {
  token: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<VerifyPaymentResult> {
  if (!isValidPublicShareToken(input.token)) {
    return { ok: false, error: "Invalid invoice link." };
  }
  const ip = await getClientIp();
  const gate = await publicSignLimit(`pay-verify:${ip}:${input.token}`);
  if (!gate.ok) return { ok: false, error: gate.message };

  const admin = getAdminSupabase();
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("public_token", input.token)
    .maybeSingle();
  if (!invoiceRow) return { ok: false, error: "Invoice not found." };
  const invoice = invoiceRow as unknown as InvoiceRow;

  if (invoice.status === "paid") {
    return { ok: true, alreadyPaid: true };
  }

  const env = requireServerEnv();
  if (!env.razorpayKeySecret) {
    return {
      ok: false,
      error: "Payment verification is unavailable right now.",
    };
  }

  const { data: attemptRow } = await admin
    .from("invoice_payment_attempts")
    .select("invoice_id, amount, currency, status, payment_method")
    .eq("invoice_id", invoice.id)
    .eq("razorpay_order_id", input.razorpayOrderId)
    .eq("payment_method", "stackivo_managed")
    .maybeSingle();
  const attempt =
    attemptRow as
      | {
          invoice_id: string;
          amount: number | string | null;
          currency: string | null;
          status: string | null;
          payment_method: string | null;
        }
      | null;
  if (!attempt) {
    return { ok: false, error: "Payment order does not match this invoice." };
  }
  const expectedAmount = Number(invoice.total_amount);
  const attemptAmount = Number(attempt.amount);
  if (
    !Number.isFinite(attemptAmount) ||
    Math.round(attemptAmount * 100) !== Math.round(expectedAmount * 100) ||
    (attempt.currency || "INR").toUpperCase() !== (invoice.currency || "INR").toUpperCase()
  ) {
    return { ok: false, error: "Payment order amount does not match this invoice." };
  }

  // HMAC verify with PLATFORM secret -----------------------------------
  const expected = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`)
    .digest("hex");
  if (expected.length !== input.razorpaySignature.length) {
    return { ok: false, error: "Invalid payment signature." };
  }
  const ok = crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(input.razorpaySignature, "hex"),
  );
  if (!ok) {
    return { ok: false, error: "Invalid payment signature." };
  }

  // Persist payment + flip invoice ------------------------------------
  const now = new Date().toISOString();
  const total = Number(invoice.total_amount);

  await admin
    .from("invoices")
    .update({
      status: "paid",
      paid_at: now,
      payment_status: "captured",
      payment_method: "razorpay",
      payment_method_used: "stackivo_managed",
      payment_reference: input.razorpayPaymentId,
      payment_amount: total,
      payment_recorded_at: now,
    } as never)
    .eq("id", invoice.id)
    // Guard against racing with the webhook — only flip if not paid yet.
    .neq("status", "paid");

  await admin
    .from("invoice_payment_attempts")
    .upsert(
      {
        invoice_id: invoice.id,
        user_id: invoice.user_id,
        razorpay_order_id: input.razorpayOrderId,
        razorpay_payment_id: input.razorpayPaymentId,
        amount: total,
        currency: invoice.currency,
        status: "captured",
        payment_method: "stackivo_managed",
        payout_status: "pending",
      } as never,
      { onConflict: "razorpay_payment_id" },
    );

  // Receipt + client lookup -------------------------------------------
  let payerEmail: string | null = null;
  let payerName: string | null = null;
  if (invoice.client_id) {
    const { data: client } = await admin
      .from("clients")
      .select("email, full_name")
      .eq("id", invoice.client_id)
      .maybeSingle();
    const c = client as { email?: string | null; full_name?: string | null } | null;
    payerEmail = c?.email ?? null;
    payerName = c?.full_name ?? null;
  }

  try {
    await generateReceiptForInvoice({
      invoiceId: invoice.id,
      userId: invoice.user_id,
      paymentMethod: "stackivo_managed",
      amount: total,
      currency: invoice.currency,
      paidAt: now,
      payerEmail,
      payerName,
      reference: input.razorpayPaymentId,
    });
  } catch {
    // Receipt generation failures don't reverse the payment — log and
    // continue. The receipt will be generated lazily on first read if
    // missing.
  }

  await admin.from("activity_events").insert({
    user_id: invoice.user_id,
    kind: "invoice_paid",
    entity_type: "invoice",
    entity_id: invoice.id,
    title: `Invoice ${invoice.invoice_number} paid`,
    metadata: {
      via: "stackivo_managed",
      payment_id: input.razorpayPaymentId,
      amount: total,
      currency: invoice.currency,
    },
  } as never);

  await admin.from("notifications").insert({
    user_id: invoice.user_id,
    type: "invoice_paid",
    title: `Invoice ${invoice.invoice_number} paid`,
    message: `Your client just paid ${formatCurrencyAmount(Number(invoice.total_amount), invoice.currency)}. Payout to your bank in 1-2 business days.`,
  } as never);

  if (payerEmail) {
    void sendInvoiceReceiptAction({
      invoiceId: invoice.id,
      toEmail: payerEmail,
      toName: payerName,
    });
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoice.id}`);

  return { ok: true, alreadyPaid: false };
}
