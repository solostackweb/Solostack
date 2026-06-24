import "server-only";

/**
 * Razorpay Smart Collect — per-invoice Virtual UPI accounts.
 *
 * When a client opens an invoice for a freelancer with `upi_smart` payment
 * method, we create a Virtual Account with a VPA receiver. The client pays
 * to that VPA; the `virtual_account.credited` webhook fires and we mark the
 * invoice paid automatically.
 *
 * Design choices
 * ──────────────
 * • Virtual accounts are created lazily when the public invoice page loads.
 * • We store the VA id + VPA on the invoice row so repeat page loads reuse
 *   the same VPA instead of creating a new one.
 * • VA is closed automatically when:
 *     - The webhook marks the invoice paid (we call closeVirtualAccount then),
 *     - OR the close_by timestamp passes (we set it to invoice due date + 7d).
 * • Amount is set on the VA so Razorpay rejects under/over payments.
 */

import { getAdminSupabase } from "@/lib/supabase/admin";
import { createVirtualAccount, closeVirtualAccount } from "./client";

/**
 * Get or create the Smart Collect virtual account for an invoice.
 *
 * Returns the VPA the client should pay to.
 * Idempotent — subsequent calls for the same invoice return the stored VPA.
 */
export async function getOrCreateInvoiceVirtualAccount(
  invoiceId: string,
): Promise<{ vpa: string; virtualAccountId: string }> {
  const admin = getAdminSupabase();

  // Check if we already created one for this invoice.
  const { data: inv } = await admin
    .from("invoices")
    .select(
      "id, invoice_number, total_amount, currency, due_date, status, smart_collect_vpa, smart_collect_virtual_account_id, smart_collect_expires_at",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  const invoice = inv as {
    id: string;
    invoice_number: string;
    total_amount: number;
    currency: string;
    due_date: string | null;
    status: string;
    smart_collect_vpa: string | null;
    smart_collect_virtual_account_id: string | null;
    smart_collect_expires_at: string | null;
  } | null;

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);
  if ((invoice.currency || "INR").toUpperCase() !== "INR") {
    throw new Error("Smart Collect UPI is only available for INR invoices.");
  }

  // Already created + still active (not expired) → reuse.
  if (invoice.smart_collect_vpa && invoice.smart_collect_virtual_account_id) {
    const expiresAt = invoice.smart_collect_expires_at
      ? new Date(invoice.smart_collect_expires_at)
      : null;
    if (!expiresAt || expiresAt > new Date()) {
      return {
        vpa: invoice.smart_collect_vpa,
        virtualAccountId: invoice.smart_collect_virtual_account_id,
      };
    }
  }

  // Determine close timestamp: invoice due date + 7 days, or 30 days from now.
  const closeBy = invoice.due_date
    ? Math.floor(
        (new Date(invoice.due_date).getTime() + 7 * 24 * 60 * 60 * 1000) /
          1000,
      )
    : Math.floor(Date.now() / 1000 + 30 * 24 * 60 * 60);

  const amountPaise = Math.round(Number(invoice.total_amount) * 100);

  const va = await createVirtualAccount({
    name: `Invoice ${invoice.invoice_number}`,
    description: `Pay invoice ${invoice.invoice_number} via UPI`,
    amountPaise,
    closeByUnix: closeBy,
    receipt: invoiceId,
  });

  const vpa = va.receivers?.[0]?.address ?? "";
  const expiresAt = new Date(closeBy * 1000).toISOString();

  // Persist to invoice row.
  await admin
    .from("invoices")
    .update({
      smart_collect_virtual_account_id: va.id,
      smart_collect_vpa: vpa,
      smart_collect_expires_at: expiresAt,
    } as never)
    .eq("id", invoiceId);

  return { vpa, virtualAccountId: va.id };
}

/**
 * Close the virtual account attached to an invoice (called after payment).
 * Safe to call even if the VA is already closed or doesn't exist.
 */
export async function closeInvoiceVirtualAccount(
  invoiceId: string,
): Promise<void> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("invoices")
    .select("smart_collect_virtual_account_id")
    .eq("id", invoiceId)
    .maybeSingle();

  const vaId = (
    data as { smart_collect_virtual_account_id: string | null } | null
  )?.smart_collect_virtual_account_id;

  if (!vaId) return;

  try {
    await closeVirtualAccount(vaId);
  } catch {
    // VA may already be closed/paid — not fatal.
  }
}

/**
 * Resolve a payment from a `virtual_account.credited` webhook payload.
 *
 * Returns the invoice_id for the credited virtual account, or null if the
 * VA doesn't match a known invoice.
 */
export async function resolveVirtualAccountInvoice(
  virtualAccountId: string,
): Promise<string | null> {
  const admin = getAdminSupabase();
  const { data } = await admin
    .from("invoices")
    .select("id")
    .eq("smart_collect_virtual_account_id", virtualAccountId)
    .maybeSingle();

  return (data as { id: string } | null)?.id ?? null;
}
