"use server";

/**
 * Manual payment recording for invoices.
 *
 * This is the freelancer-side counterpart to the public Razorpay verify
 * action used in stackivo_managed. Because UPI payments happen outside
 * Stackivo, only the freelancer can authoritatively say a transfer
 * arrived. They enter the amount, method, reference/proof, and optional
 * notes; we:
 *
 *   1. Verify the invoice belongs to the calling user.
 *   2. Insert an `invoice_manual_confirmations` audit row.
 *   3. Generate the receipt (`generateReceiptForInvoice`).
 *   4. Insert an `invoice_payments` ledger row.
 *   5. Flip the invoice to `paid` or `partially_paid`.
 *   6. Email the receipt to the client.
 *
 * The action is idempotent: if the invoice is already `paid`, we return
 * `{ ok: true, alreadyPaid: true }` without writing anything.
 *
 * No Razorpay round-trip happens here. Stackivo cannot verify that the
 * UPI transfer actually occurred — we are deliberately trusting the
 * freelancer's confirmation, which is the explicit design of this flow.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { getUserPaymentMethod } from "@/features/billing/payment-methods";
import { generateReceiptForInvoice } from "./receipts";
import { sendInvoiceReceiptAction } from "./delivery";
import type { InvoicePaymentRow, InvoiceRow } from "@/lib/supabase/types";

export type ManualPaymentResult =
  | {
      ok: true;
      alreadyPaid: boolean;
      receiptNumber: string;
      status: "paid" | "partially_paid";
    }
  | { ok: false; error: string };

const manualSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice."),
  amount: z.coerce.number().positive().optional(),
  receivedAmount: z.coerce.number().positive().optional(),
  receivedCurrency: z.string().trim().min(3).max(3).optional(),
  method: z
    .enum(["upi", "bank", "wire", "wise", "paypal", "stripe", "cash", "other"])
    .default("upi"),
  // Optional UPI reference / UTR. Trimmed; empty becomes null.
  reference: z.string().trim().max(120).optional().nullable(),
  proofUrl: z.string().trim().url().max(500).optional().nullable(),
  // Optional ISO date string for when the money actually arrived; defaults
  // to now if absent. The freelancer can backdate slightly to match their
  // bank statement.
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

export async function markInvoicePaidManuallyAction(
  _prev: ManualPaymentResult | undefined,
  formData: FormData,
): Promise<ManualPaymentResult> {
  const parsed = manualSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount") || undefined,
    receivedAmount: formData.get("receivedAmount") || undefined,
    receivedCurrency: formData.get("receivedCurrency") || undefined,
    method: formData.get("method") || "upi",
    reference: formData.get("reference") || null,
    proofUrl: formData.get("proofUrl") || null,
    paidAt: formData.get("paidAt") || undefined,
    notes: formData.get("notes") || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.flatten().formErrors[0] ?? "Invalid input.",
    };
  }

  const userId = await requireUserId();
  const admin = getAdminSupabase();

  // --- 1. Ownership + state checks ------------------------------------
  const { data: invoiceRow } = await admin
    .from("invoices")
    .select("*")
    .eq("id", parsed.data.invoiceId)
    .maybeSingle();
  const invoice = invoiceRow as unknown as InvoiceRow | null;
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.user_id !== userId) {
    return { ok: false, error: "You don't own this invoice." };
  }
  if (invoice.status === "paid") {
    return { ok: true, alreadyPaid: true, receiptNumber: "", status: "paid" };
  }

  const total = Number(invoice.total_amount);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, error: "This invoice has no amount due." };
  }

  const { data: paymentRows } = await admin
    .from("invoice_payments")
    .select("amount")
    .eq("invoice_id", invoice.id);
  const ledgerPaid = ((paymentRows as Pick<InvoicePaymentRow, "amount">[] | null) ?? [])
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const existingSummaryPaid = Number(invoice.payment_amount ?? 0);
  const paidBefore = Math.max(ledgerPaid, existingSummaryPaid);
  const balance = Math.max(0, Math.round((total - paidBefore) * 100) / 100);
  if (balance <= 0) {
    return { ok: true, alreadyPaid: true, receiptNumber: "", status: "paid" };
  }

  const amount = Math.round((parsed.data.amount ?? balance) * 100) / 100;
  if (amount > balance) {
    return {
      ok: false,
      error: `Payment exceeds the remaining balance of ${invoice.currency} ${balance.toFixed(2)}.`,
    };
  }

  const receivedCurrency = (parsed.data.receivedCurrency ?? invoice.currency).toUpperCase();
  const receivedAmount = Math.round((parsed.data.receivedAmount ?? amount) * 100) / 100;
  const fxRateToInvoice =
    receivedCurrency === invoice.currency
      ? 1
      : Math.round((amount / receivedAmount) * 1_000_000) / 1_000_000;
  const totalPaid = Math.round((paidBefore + amount) * 100) / 100;
  const isFullyPaid = totalPaid >= total;
  const nextStatus = isFullyPaid ? "paid" : "partially_paid";

  // We don't strictly require `payment_method_type = upi_manual` to mark
  // paid — a freelancer might receive a bank transfer outside the flow
  // and want to record it. But we DO tag the manual confirmation with
  // whatever method is configured for clarity in the receipt.
  const method = await getUserPaymentMethod(userId);
  // Tag the receipt with the configured method type. Both manual flows
  // (UPI and bank transfer) produce a "upi_manual" receipt by convention;
  // the reference field carries the distinguishing detail.
  const paymentMethodForReceipt: "upi_manual" =
    method?.type === "upi_manual" ? "upi_manual" : "upi_manual";

  const paidAtIso = parsed.data.paidAt ?? new Date().toISOString();
  const receiptReference =
    parsed.data.reference ?? `manual-${invoice.id.slice(0, 8)}-${Date.now()}`;

  // --- 2. Audit row (manual confirmation) -----------------------------
  await admin.from("invoice_manual_confirmations").insert({
    invoice_id: invoice.id,
    user_id: userId,
    confirmed_by_user_id: userId,
    amount,
    currency: invoice.currency,
    paid_at: paidAtIso,
    reference: parsed.data.reference ?? null,
    notes: parsed.data.notes ?? null,
  } as never);

  // --- 3. Receipt ----------------------------------------------------
  const clientLookup = invoice.client_id
    ? await admin
        .from("clients")
        .select("email, full_name")
        .eq("id", invoice.client_id)
        .maybeSingle()
    : null;
  const clientRow = clientLookup?.data as
    | { email?: string | null; full_name?: string | null }
    | null;
  const payerEmail = clientRow?.email ?? null;
  const payerName = clientRow?.full_name ?? null;

  let receiptNumber = "";
  try {
    const { receipt } = await generateReceiptForInvoice({
      invoiceId: invoice.id,
      userId,
      paymentMethod: paymentMethodForReceipt,
      amount,
      currency: invoice.currency,
      paidAt: paidAtIso,
      payerEmail,
      payerName,
      reference: receiptReference,
      notes: parsed.data.notes ?? null,
    });
    receiptNumber = receipt.receipt_number;
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Could not generate receipt: ${err.message}`
          : "Could not generate receipt.",
    };
  }

  const { data: ledgerRow } = await admin
    .from("invoice_payments")
    .insert({
      invoice_id: invoice.id,
      user_id: userId,
      source: "manual",
      method: parsed.data.method,
      amount,
      currency: invoice.currency,
      received_amount: receivedAmount,
      received_currency: receivedCurrency,
      fx_rate_to_invoice: fxRateToInvoice,
      inr_equivalent:
        invoice.currency === "INR"
          ? amount
          : invoice.fx_rate_to_inr
            ? Math.round(amount * Number(invoice.fx_rate_to_inr) * 100) / 100
            : null,
      paid_at: paidAtIso,
      reference: parsed.data.reference ?? null,
      proof_url: parsed.data.proofUrl ?? null,
      notes: parsed.data.notes ?? null,
      receipt_id: receiptNumber ? null : null,
      metadata: {
        receiptNumber,
      },
    } as never)
    .select("id")
    .single();

  if (ledgerRow && receiptNumber) {
    const { data: receipt } = await admin
      .from("invoice_receipts")
      .select("id")
      .eq("invoice_id", invoice.id)
      .eq("receipt_number", receiptNumber)
      .maybeSingle();
    const receiptId = (receipt as { id?: string } | null)?.id ?? null;
    if (receiptId) {
      await admin
        .from("invoice_payments")
        .update({ receipt_id: receiptId } as never)
        .eq("id", (ledgerRow as { id: string }).id);
    }
  }

  // --- 4. Update invoice summary --------------------------------------
  await admin
    .from("invoices")
    .update({
      status: nextStatus,
      paid_at: isFullyPaid ? paidAtIso : invoice.paid_at,
      payment_status: isFullyPaid ? "captured" : "partially_paid",
      payment_method: parsed.data.method,
      payment_method_used: "upi_manual",
      payment_reference: parsed.data.reference ?? null,
      payment_amount: totalPaid,
      payment_recorded_at: paidAtIso,
    } as never)
    .eq("id", invoice.id)
    .neq("status", "paid");

  // Activity + notification
  await admin.from("activity_events").insert({
    user_id: userId,
    kind: isFullyPaid ? "invoice_paid" : "invoice_partially_paid",
    entity_type: "invoice",
    entity_id: invoice.id,
    title: isFullyPaid
      ? `Invoice ${invoice.invoice_number} marked paid`
      : `Partial payment recorded for ${invoice.invoice_number}`,
    metadata: {
      via: "manual",
      method: parsed.data.method,
      reference: parsed.data.reference ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      amount,
      currency: invoice.currency,
      receivedAmount,
      receivedCurrency,
      balance: Math.max(0, Math.round((total - totalPaid) * 100) / 100),
    },
  } as never);

  await admin.from("notifications").insert({
    user_id: userId,
    type: isFullyPaid ? "invoice_paid" : "invoice_partially_paid",
    title: isFullyPaid
      ? `Invoice ${invoice.invoice_number} marked paid`
      : `Partial payment recorded for ${invoice.invoice_number}`,
    message: isFullyPaid
      ? `Receipt ${receiptNumber} generated and emailed.`
      : `Receipt ${receiptNumber} generated for a partial payment.`,
  } as never);

  // --- 5. Receipt email (fire-and-forget) -----------------------------
  if (payerEmail) {
    void sendInvoiceReceiptAction({
      invoiceId: invoice.id,
      toEmail: payerEmail,
      toName: payerName,
    });
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoice.id}`);

  return { ok: true, alreadyPaid: false, receiptNumber, status: nextStatus };
}
