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
import { recordActivity } from "@/features/activity/server";
import { markTimeEntriesInvoiced } from "@/features/time/server";
import { createNotification } from "@/features/notifications/server";
import { generateReceiptForInvoice } from "./receipts";
import type { ClientRow, UserProfileRow } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

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
  client: { gstRegistered: boolean; stateCode: string | null };
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
          .select("gst_registered, state_code")
          .eq("id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const sellerRow = profile as Pick<UserProfileRow, "gst_registered" | "state_code"> | null;
  const clientRow = client as Pick<ClientRow, "gst_registered" | "state_code"> | null;

  return {
    seller: {
      gstRegistered: sellerRow?.gst_registered ?? false,
      stateCode: sellerRow?.state_code ?? null,
    },
    client: {
      gstRegistered: clientRow?.gst_registered ?? false,
      stateCode: clientRow?.state_code ?? null,
    },
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
  const totals = calculateInvoice({
    lines: parsed.data.lines,
    discount: parsed.data.discount,
    seller: parties.seller,
    client: parties.client,
  });

  const insertRow = {
    user_id: userId,
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    invoice_number: parsed.data.invoiceNumber,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    currency: parsed.data.currency,
    status: parsed.data.status,
    sent_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
    paid_at: parsed.data.status === "paid" ? new Date().toISOString() : null,
    payment_status: parsed.data.status === "paid" ? "paid" : null,
    notes: parsed.data.notes ?? null,
    terms: parsed.data.terms ?? null,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    cgst_amount: totals.cgstAmount,
    sgst_amount: totals.sgstAmount,
    igst_amount: totals.igstAmount,
    gst_amount: totals.taxTotal,
    total_amount: totals.total,
    tax_mode: totals.taxMode,
    classification: totals.decision.classification,
    seller_state_code: parties.seller.stateCode,
    client_state_code: parties.client.stateCode,
    footer_note: totals.decision.footerNote,
    payment_amount: parsed.data.status === "paid" ? totals.total : null,
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
    metadata: { total: totals.total, currency: parsed.data.currency },
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

  const parties = await resolveParties(userId, parsed.data.clientId);
  const totals = calculateInvoice({
    lines: parsed.data.lines,
    discount: parsed.data.discount,
    seller: parties.seller,
    client: parties.client,
  });

  const update = {
    client_id: parsed.data.clientId ?? null,
    project_id: parsed.data.projectId ?? null,
    invoice_number: parsed.data.invoiceNumber,
    issue_date: parsed.data.issueDate,
    due_date: parsed.data.dueDate,
    currency: parsed.data.currency,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
    terms: parsed.data.terms ?? null,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    cgst_amount: totals.cgstAmount,
    sgst_amount: totals.sgstAmount,
    igst_amount: totals.igstAmount,
    gst_amount: totals.taxTotal,
    total_amount: totals.total,
    tax_mode: totals.taxMode,
    classification: totals.decision.classification,
    seller_state_code: parties.seller.stateCode,
    client_state_code: parties.client.stateCode,
    footer_note: totals.decision.footerNote,
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
  await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase.from("invoices").delete().eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/invoices");
  return { ok: true, message: "Invoice deleted." };
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
      message: `${invoice.currency} ${Number(invoice.total_amount).toFixed(2)} has been recorded as paid.`,
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
      tax_mode: orig.tax_mode,
      classification: orig.classification,
      seller_state_code: orig.seller_state_code,
      client_state_code: orig.client_state_code,
      footer_note: orig.footer_note,
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
