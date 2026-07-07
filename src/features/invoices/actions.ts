"use server";

/**
 * Server actions for invoice persistence.
 *
 * Flow:
 *   1. Validate the form payload (Zod) — same schema as the client form.
 *   2. Resolve seller (current user) + client GST status to choose tax mode.
 *   3. Run the pure calculation engine to derive subtotal/CGST/SGST/IGST/total.
 *   4. Persist the invoice row + replace its line items in a single sequence.
 *   5. Bump `user_profiles.invoice_next_number` so future numbers are unique.
 *   6. Log an activity event.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  invoiceCrudSchema,
  invoiceIdSchema,
  invoiceStatusSchema,
} from "./server-schemas";
import { calculateInvoice } from "./engine";
import { getFxRateToInr } from "@/features/payments/fx";
import { recordActivity } from "@/features/activity/server";
import { markTimeEntriesInvoiced } from "@/features/time/server";
import { createNotification } from "@/features/notifications/server";
import { generateReceiptForInvoice } from "./receipts";
import { formatCurrencyAmount } from "@/lib/format";
import type { ClientRow, UserProfileRow } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

class FxRateUnavailableError extends Error {
  constructor(currency: string) {
    super(
      `Could not fetch the INR exchange rate for ${currency}. Please try again in a moment before saving this export invoice.`,
    );
    this.name = "FxRateUnavailableError";
  }
}

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

/**
 * Pull the form payload — supports either a flat HTML form (rare for
 * complex line-item editors) OR a JSON-encoded `payload` field which is
 * the canonical client-side path.
 */
function readPayload(formData: FormData): unknown {
  const raw = formData.get("payload");
  if (typeof raw === "string" && raw.length > 0) {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return {
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    invoiceNumber: formData.get("invoiceNumber"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    currency: formData.get("currency") ?? "INR",
    status: formData.get("status") ?? "draft",
    discount: formData.get("discount") ?? 0,
    notes: formData.get("notes"),
    terms: formData.get("terms"),
    lines: [],
  };
}

interface ResolvedParties {
  seller: { gstRegistered: boolean; stateCode: string | null };
  client: {
    gstRegistered: boolean;
    stateCode: string | null;
    currency: string;
    isForeign: boolean;
  };
}

async function resolveParties(
  userId: string,
  clientId: string | undefined,
): Promise<ResolvedParties> {
  const supabase = await getServerSupabase();
  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("gst_registered, state_code")
      .eq("id", userId)
      .maybeSingle(),
    clientId
      ? supabase
          .from("clients")
          .select("gst_registered, state_code, currency, is_foreign")
          .eq("id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sellerRow = profile as Pick<UserProfileRow, "gst_registered" | "state_code"> | null;
  const clientRow = client as unknown as
    | (Pick<ClientRow, "gst_registered" | "state_code"> & {
        currency?: string | null;
        is_foreign?: boolean | null;
      })
    | null;

  return {
    seller: {
      gstRegistered: sellerRow?.gst_registered ?? false,
      stateCode: sellerRow?.state_code ?? null,
    },
    client: {
      gstRegistered: clientRow?.gst_registered ?? false,
      stateCode: clientRow?.state_code ?? null,
      currency: clientRow?.currency ?? "INR",
      isForeign: clientRow?.is_foreign ?? false,
    },
  };
}

/**
 * Multi-currency + export adjustments. Foreign clients = export of services:
 * zero-rated (no GST) under LUT, billed in their currency, with the INR
 * equivalent locked via the FX rate at issue for Pulse / books.
 */
async function computeIntl(
  parties: ResolvedParties,
  totals: ReturnType<typeof calculateInvoice>,
) {
  const isForeign = parties.client.isForeign;
  const currency = isForeign ? parties.client.currency || "USD" : "INR";
  const cgst = isForeign ? 0 : totals.cgstAmount;
  const sgst = isForeign ? 0 : totals.sgstAmount;
  const igst = isForeign ? 0 : totals.igstAmount;
  const gstTotal = isForeign ? 0 : totals.taxTotal;
  const grandTotal = isForeign
    ? Math.round((totals.subtotal - totals.discount) * 100) / 100
    : totals.total;
  const footerNote = isForeign
    ? "Export of services under LUT, without payment of IGST."
    : totals.decision.footerNote;
  const fxRate = await getFxRateToInr(currency);
  if (fxRate === null) throw new FxRateUnavailableError(currency);
  const inrEquivalent = Math.round(grandTotal * fxRate * 100) / 100;
  return {
    isForeign,
    currency,
    cgst,
    sgst,
    igst,
    gstTotal,
    grandTotal,
    footerNote,
    fxRate,
    inrEquivalent,
  };
}

/**
 * Replace ALL invoice items for a given invoice id with the supplied set.
 * Simpler + safer than a partial diff for the MVP.
 */
async function replaceInvoiceItems(
  invoiceId: string,
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    gstRate: number;
    amount: number;
    position: number;
  }>,
) {
  const supabase = await getServerSupabase();
  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (lines.length === 0) return;
  const rows = lines.map((l, i) => ({
    invoice_id: invoiceId,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    gst_rate: l.gstRate,
    amount: l.amount,
    position: l.position ?? i,
  }));
  await supabase.from("invoice_items").insert(rows as never);
}

// --- Create -----------------------------------------------------------------

export async function createInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = invoiceCrudSchema.safeParse(readPayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const parties = await resolveParties(userId, parsed.data.clientId);
  // GST mode is deliberately computed on the server from the seller state and
  // client's domestic state/place of supply. The client payload does not get to
  // choose CGST+SGST vs IGST, which prevents incorrect tax splits.
  const totals = calculateInvoice({
    lines: parsed.data.lines,
    discount: parsed.data.discount,
    seller: parties.seller,
    client: parties.client,
  });

  let intl: Awaited<ReturnType<typeof computeIntl>>;
  try {
    intl = await computeIntl(parties, totals);
  } catch (err) {
    if (err instanceof FxRateUnavailableError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const insertRow = {
    user_id: userId,
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    invoice_number: parsed.data.invoiceNumber,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    currency: intl.currency,
    status: parsed.data.status,
    sent_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
    paid_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
    payment_status: parsed.data.status === "paid" ? "paid" : null,
    notes: parsed.data.notes ?? null,
    terms: parsed.data.terms ?? null,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    cgst_amount: intl.cgst,
    sgst_amount: intl.sgst,
    igst_amount: intl.igst,
    gst_amount: intl.gstTotal,
    total_amount: intl.grandTotal,
    tax_mode: totals.taxMode,
    classification: totals.decision.classification,
    seller_state_code: parties.seller.stateCode,
    client_state_code: parties.client.stateCode,
    footer_note: intl.footerNote,
    hsn_sac: parsed.data.hsnSac ?? null,
    is_export: intl.isForeign,
    fx_rate_to_inr: intl.fxRate,
    inr_equivalent: intl.inrEquivalent,
    payment_amount: parsed.data.status === "paid" ? intl.grandTotal : null,
    payment_recorded_at:
      parsed.data.status === "paid" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save invoice." };
  }

  const invoiceId = (data as { id: string }).id;

  await replaceInvoiceItems(
    invoiceId,
    totals.lines.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      gstRate: l.gstRate,
      amount: l.amount,
      position: i,
    })),
  );

  // Claim the billable time entries this invoice covers. The update is
  // self-guarding (only unbilled+billable+owned rows match), so duplicates
  // or stale ids are silently skipped rather than double-billed.
  if (parsed.data.timeEntryIds && parsed.data.timeEntryIds.length > 0) {
    await markTimeEntriesInvoiced(userId, parsed.data.timeEntryIds, invoiceId);
  }

  // Bump invoice numbering so the next invoice gets a fresh number. Best
  // effort — a failure here does NOT roll back the invoice.
  const currentCounter = await getCurrentInvoiceCounter(userId);
  await supabase
    .from("user_profiles")
    .update({ invoice_next_number: currentCounter + 1 } as never)
    .eq("id", userId);

  await recordActivity({
    kind: "invoice_created",
    entityType: "invoice",
    entityId: invoiceId,
    title: `Created invoice ${parsed.data.invoiceNumber}`,
    metadata: { total: intl.grandTotal, currency: intl.currency },
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath("/dashboard");
  return {
    ok: true,
    data: { id: invoiceId },
    message: "Invoice created.",
  };
}

async function getCurrentInvoiceCounter(userId: string): Promise<number> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("user_profiles")
    .select("invoice_next_number")
    .eq("id", userId)
    .maybeSingle();
  return (data as { invoice_next_number?: number } | null)?.invoice_next_number ?? 1;
}

// --- Update -----------------------------------------------------------------

export async function updateInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = invoiceIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid invoice id." };

  const parsed = invoiceCrudSchema.safeParse(readPayload(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Safety: only draft invoices may be edited. Once an invoice has been sent
  // the client may already hold a copy, so mutating it would undermine its
  // credibility and legal standing. Corrections go through "Duplicate as draft".
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", idParse.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Invoice not found." };
  if ((existing as { status: string }).status !== "draft") {
    return {
      ok: false,
      error:
        "Only draft invoices can be edited. Duplicate this invoice to make a corrected copy.",
    };
  }

  const parties = await resolveParties(userId, parsed.data.clientId);
  // Same server-side GST classification as createInvoiceAction.
  const totals = calculateInvoice({
    lines: parsed.data.lines,
    discount: parsed.data.discount,
    seller: parties.seller,
    client: parties.client,
  });

  let intl: Awaited<ReturnType<typeof computeIntl>>;
  try {
    intl = await computeIntl(parties, totals);
  } catch (err) {
    if (err instanceof FxRateUnavailableError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }

  const update = {
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    invoice_number: parsed.data.invoiceNumber,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    currency: intl.currency,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
    terms: parsed.data.terms ?? null,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    cgst_amount: intl.cgst,
    sgst_amount: intl.sgst,
    igst_amount: intl.igst,
    gst_amount: intl.gstTotal,
    total_amount: intl.grandTotal,
    tax_mode: totals.taxMode,
    classification: totals.decision.classification,
    seller_state_code: parties.seller.stateCode,
    client_state_code: parties.client.stateCode,
    footer_note: intl.footerNote,
    hsn_sac: parsed.data.hsnSac ?? null,
    is_export: intl.isForeign,
    fx_rate_to_inr: intl.fxRate,
    inr_equivalent: intl.inrEquivalent,
  };

  const { error } = await supabase
    .from("invoices")
    .update(update as never)
    .eq("id", idParse.data);

  if (error) return { ok: false, error: error.message };

  await replaceInvoiceItems(
    idParse.data,
    totals.lines.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      gstRate: l.gstRate,
      amount: l.amount,
      position: i,
    })),
  );

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${idParse.data}`);
  return { ok: true, message: "Invoice updated." };
}

// --- Delete -----------------------------------------------------------------

export async function deleteInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = invoiceIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid invoice id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Only drafts may be hard-deleted. Issued invoices must be retained for the
  // consecutive-numbering audit trail — they are cancelled, not deleted.
  const { data: existing } = await supabase
    .from("invoices")
    .select("status")
    .eq("id", idParse.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Invoice not found." };
  if ((existing as { status: string }).status !== "draft") {
    return {
      ok: false,
      error:
        "Only draft invoices can be deleted. Cancel this invoice instead to keep your records intact.",
    };
  }

  const { error } = await supabase
    .from("invoices")
    .delete()
    .eq("id", idParse.data)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/invoices");
  return { ok: true, message: "Invoice deleted." };
}

/**
 * Cancel (void) an issued invoice. The row + its number are retained and
 * flagged `cancelled` so the audit trail stays intact; any billed time
 * entries are released so they can be re-invoiced. Drafts should be deleted,
 * and paid / partially-paid invoices need a refund or credit note instead.
 */
export async function cancelInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = invoiceIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid invoice id." };
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data: existing } = await supabase
    .from("invoices")
    .select("status, invoice_number")
    .eq("id", idParse.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Invoice not found." };
  const row = existing as { status: string; invoice_number: string };
  if (row.status === "draft") {
    return { ok: false, error: "Delete draft invoices instead of cancelling them." };
  }
  if (row.status === "paid" || row.status === "partially_paid") {
    return {
      ok: false,
      error: "Paid invoices can't be cancelled. Issue a refund or credit note instead.",
    };
  }
  if (row.status === "cancelled") {
    return { ok: false, error: "This invoice is already cancelled." };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "cancelled" } as never)
    .eq("id", idParse.data)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  // Release any time entries this invoice had claimed so they can be re-billed.
  await supabase
    .from("time_entries")
    .update({ invoice_id: null, invoiced_at: null } as never)
    .eq("invoice_id", idParse.data);

  await recordActivity({
    kind: "invoice_cancelled",
    entityType: "invoice",
    entityId: idParse.data,
    title: `Invoice ${row.invoice_number} cancelled`,
  });

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${idParse.data}`);
  return { ok: true, message: "Invoice cancelled." };
}

// --- Status transitions ----------------------------------------------------

export async function setInvoiceStatusAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = invoiceIdSchema.safeParse(formData.get("id"));
  const statusParse = invoiceStatusSchema.safeParse(formData.get("status"));
  if (!idParse.success || !statusParse.success) {
    return { ok: false, error: "Invalid input." };
  }
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: statusParse.data };
  if (statusParse.data === "sent") patch.sent_at = now;
  if (statusParse.data === "paid") {
    patch.paid_at = now;
    patch.payment_recorded_at = now;
    patch.payment_status = "paid";
  }

  const { data: invoiceRow, error } = await supabase
    .from("invoices")
    .update(patch as never)
    .select("id, user_id, invoice_number, total_amount, currency")
    .eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };
  const invoice = (invoiceRow?.[0] as
    | {
        id: string;
        user_id: string;
        invoice_number: string;
        total_amount: number;
        currency: string;
      }
    | undefined);

  await recordActivity({
    kind: `invoice_${statusParse.data}`,
    entityType: "invoice",
    entityId: idParse.data,
    title: `Invoice marked ${statusParse.data}`,
  });

  if (statusParse.data === "paid" && invoice) {
    // Generate receipt row so the "Download Receipt" button on the detail
    // page works even when paid from the list (no manual dialog used).
    void generateReceiptForInvoice({
      invoiceId: invoice.id,
      userId,
      paymentMethod: "upi_manual",
      amount: Number(invoice.total_amount),
      currency: invoice.currency,
      paidAt: now,
    }).catch(() => {
      // Best-effort — don't fail the status flip if receipt minting fails.
    });

    await createNotification({
      type: "invoice_paid",
      title: `Invoice ${invoice.invoice_number} marked paid`,
      message: `${formatCurrencyAmount(Number(invoice.total_amount), invoice.currency)} has been recorded as paid.`,
    });
  }

  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${idParse.data}`);
  return { ok: true, message: `Marked ${statusParse.data}.` };
}

// --- Duplicate ---------------------------------------------------------------

/**
 * Clone an invoice (and its line items) as a new draft with today's dates.
 * The invoice number is auto-incremented from the user's running counter so
 * the duplicate never collides with the original.
 */
export async function duplicateInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const idParse = invoiceIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) return { ok: false, error: "Invalid invoice id." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Fetch original invoice + items
  const { data: original, error: fetchErr } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", idParse.data)
    .single();
  if (fetchErr || !original) return { ok: false, error: "Invoice not found." };

  const { data: originalItems, error: itemsErr } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", idParse.data)
    .order("position");
  if (itemsErr) return { ok: false, error: "Failed to fetch invoice items." };

  // Fetch user's invoice prefix + current counter to derive next number
  const { nextInvoiceNumber } = await import("./server");
  const { formatted: newNumber, next: currentNext } = await nextInvoiceNumber(userId);

  const today = new Date().toISOString().slice(0, 10);
  const orig = original as Record<string, unknown>;

  const { data: newInvoice, error: insertErr } = await supabase
    .from("invoices")
    .insert({
      user_id: userId,
      client_id: orig.client_id,
      project_id: orig.project_id,
      invoice_number: newNumber,
      issue_date: today,
      due_date: today,
      currency: orig.currency,
      status: "draft",
      notes: orig.notes,
      terms: orig.terms,
      subtotal: orig.subtotal,
      discount_amount: orig.discount_amount,
      cgst_amount: orig.cgst_amount,
      sgst_amount: orig.sgst_amount,
      igst_amount: orig.igst_amount,
      gst_amount: orig.gst_amount,
      total_amount: orig.total_amount,
      is_export: orig.is_export,
      fx_rate_to_inr: orig.fx_rate_to_inr,
      inr_equivalent: orig.inr_equivalent,
      tax_mode: orig.tax_mode,
      classification: orig.classification,
      seller_state_code: orig.seller_state_code,
      client_state_code: orig.client_state_code,
      footer_note: orig.footer_note,
      hsn_sac: orig.hsn_sac,
    } as never)
    .select("id")
    .single();

  if (insertErr || !newInvoice) {
    return { ok: false, error: insertErr?.message ?? "Failed to duplicate." };
  }

  const newId = (newInvoice as { id: string }).id;

  // Bump the invoice counter so the next number doesn't collide
  await supabase
    .from("user_profiles")
    .update({ invoice_next_number: currentNext + 1 } as never)
    .eq("id", userId);

  // Copy line items
  if (originalItems && originalItems.length > 0) {
    const newItems = (originalItems as Array<Record<string, unknown>>).map(
      (item, i) => ({
        invoice_id: newId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: item.gst_rate,
        amount: item.amount,
        position: i,
      }),
    );
    await supabase.from("invoice_items").insert(newItems as never);
  }

  await recordActivity({
    kind: "invoice_created",
    entityType: "invoice",
    entityId: newId,
    title: `Invoice ${newNumber} duplicated`,
  });

  revalidatePath("/dashboard/invoices");
  return { ok: true, data: { id: newId }, message: "Invoice duplicated." };
}
