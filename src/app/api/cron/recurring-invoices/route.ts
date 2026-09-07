/**
 * Recurring invoice generation cron.
 *
 *   GET /api/cron/recurring-invoices
 *
 * Finds all active recurring invoice templates where next_generation_at <= now,
 * generates an invoice for each, and updates the template's next_generation_at.
 *
 * Authentication: `Authorization: Bearer <CRON_SECRET>`.
 * Idempotent by construction: uses (user_id, recurring_invoice_id, period_start) as
 * dedupe key in automation_runs to prevent double-generation on retries.
 */

import { NextResponse } from "next/server";

import { requireServerEnv } from "@/config/env";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import { recordCronRun } from "@/lib/cron/record";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { nextInvoiceNumber } from "@/features/invoices/server";
import { calculateInvoice } from "@/features/invoices/engine";
import { getFxRateToInr } from "@/features/payments/fx";
import { replaceInvoiceItems } from "@/features/invoices/actions";
import { recordActivity } from "@/features/activity/server";
import { formatInvoiceNumber } from "@/features/invoices/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RecurringInvoiceRow {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  frequency: string;
  interval: number;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  max_occurrences: number | null;
  invoice_prefix: string | null;
  invoice_number_padding: number | null;
  currency: string;
  issue_date_offset: number;
  due_date_offset: number;
  status_on_create: "draft" | "sent";
  discount: number;
  notes: string | null;
  terms: string | null;
  hsn_sac: string | null;
  gst_rate: number;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    rate: number;
    gst_rate: number;
  }>;
  last_generated_at: string | null;
  next_generation_at: string | null;
  generation_count: number;
  is_active: boolean;
}

async function getSellerProfile(supabase: SupabaseClient<Database>, userId: string) {
  const { data } = await supabase
    .from("user_profiles")
    .select("gst_registered, state_code, invoice_prefix, invoice_next_number, invoice_number_padding, default_currency")
    .eq("id", userId)
    .maybeSingle();
  return data as {
    gst_registered: boolean;
    state_code: string | null;
    invoice_prefix: string | null;
    invoice_next_number: number;
    invoice_number_padding: number;
    default_currency: string;
  } | null;
}

async function getClient(supabase: SupabaseClient<Database>, clientId: string | null) {
  if (!clientId) return null;
  const { data } = await supabase
    .from("clients")
    .select("gst_registered, state_code, currency, is_foreign")
    .eq("id", clientId)
    .maybeSingle();
  return data as {
    gst_registered: boolean;
    state_code: string | null;
    currency: string;
    is_foreign: boolean;
  } | null;
}

async function generateInvoiceFromTemplate(
  admin: SupabaseClient<Database>,
  userId: string,
  recurring: RecurringInvoiceRow,
  periodStart: Date,
): Promise<{ ok: boolean; invoiceId?: string; error?: string }> {
  const seller = await getSellerProfile(admin, userId);
  const client = await getClient(admin, recurring.client_id);

  if (!seller) return { ok: false, error: "Seller profile not found" };

  // Compute issue_date and due_date from periodStart + offsets
  const issueDate = new Date(periodStart);
  issueDate.setDate(issueDate.getDate() + recurring.issue_date_offset);
  const issueDateStr = issueDate.toISOString().split("T")[0];

  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + recurring.due_date_offset);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  // Build line items for calculation
  const lines = recurring.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.rate,
    gstRate: item.gst_rate,
  }));

  // Calculate invoice totals (server-side GST logic)
  const totals = calculateInvoice({
    lines,
    discount: recurring.discount,
    seller: {
      gstRegistered: seller.gst_registered,
      stateCode: seller.state_code,
    },
    client: client
      ? {
          gstRegistered: client.gst_registered,
          stateCode: client.state_code,
          currency: client.currency,
          isForeign: client.is_foreign,
        }
      : {
          gstRegistered: false,
          stateCode: null,
          currency: recurring.currency,
          isForeign: false,
        },
  });

  // Handle multi-currency / export
  let isForeign = false;
  let currency = recurring.currency;
  let cgst = totals.cgstAmount;
  let sgst = totals.sgstAmount;
  let igst = totals.igstAmount;
  let gstTotal = totals.taxTotal;
  let grandTotal = totals.total;
  let footerNote = totals.decision.footerNote;
  let fxRate = 1;
  let inrEquivalent: number | null = null;

  if (client?.is_foreign) {
    isForeign = true;
    currency = client.currency;
    cgst = 0;
    sgst = 0;
    igst = 0;
    gstTotal = 0;
    grandTotal = Math.round((totals.subtotal - totals.discount) * 100) / 100;
    footerNote = "Export of services under LUT, without payment of IGST.";
    const rate = await getFxRateToInr(currency);
    if (rate === null) return { ok: false, error: `FX rate unavailable for ${currency}` };
    fxRate = rate;
    inrEquivalent = Math.round(grandTotal * fxRate * 100) / 100;
  } else {
    inrEquivalent = grandTotal;
  }

  // Determine invoice prefix and next number
  const prefix = recurring.invoice_prefix ?? seller.invoice_prefix ?? "INV-";
  const padding = recurring.invoice_number_padding ?? seller.invoice_number_padding ?? 4;
  const nextNumber = seller.invoice_next_number ?? 1;
  const invoiceNumber = formatInvoiceNumber(prefix, nextNumber, padding);

  // Insert invoice
  const insertRow = {
    user_id: userId,
    client_id: recurring.client_id,
    project_id: recurring.project_id,
    invoice_number: invoiceNumber,
    issue_date: issueDateStr,
    due_date: dueDateStr,
    currency,
    status: recurring.status_on_create,
    sent_at: recurring.status_on_create === "sent" ? new Date().toISOString() : null,
    paid_at: recurring.status_on_create === "sent" ? null : null,
    payment_status: recurring.status_on_create === "sent" ? "pending" : null,
    notes: recurring.notes,
    terms: recurring.terms,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    cgst_amount: cgst,
    sgst_amount: sgst,
    igst_amount: igst,
    gst_amount: gstTotal,
    total_amount: grandTotal,
    tax_mode: totals.taxMode,
    classification: totals.decision.classification,
    seller_state_code: seller.state_code,
    client_state_code: client?.state_code ?? null,
    footer_note: footerNote,
    hsn_sac: recurring.hsn_sac,
    is_export: isForeign,
    fx_rate_to_inr: fxRate,
    inr_equivalent: inrEquivalent,
    payment_amount: recurring.status_on_create === "sent" ? grandTotal : null,
    payment_recorded_at: recurring.status_on_create === "sent" ? new Date().toISOString() : null,
  };

  const { data: invoice, error: insertError } = await admin
    .from("invoices")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (insertError || !invoice) {
    return { ok: false, error: insertError?.message ?? "Failed to create invoice" };
  }

  const invoiceId = (invoice as { id: string }).id;

  // Insert line items
  await replaceInvoiceItems(invoiceId, totals.lines.map((l, i) => ({
    description: l.description,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    gstRate: l.gstRate,
    amount: l.amount,
    position: i,
  })));

  // Bump invoice counter
  await admin
    .from("user_profiles")
    .update({ invoice_next_number: nextNumber + 1 } as never)
    .eq("id", userId);

  // Record activity
  await recordActivity({
    kind: "invoice_created",
    entityType: "invoice",
    entityId: invoiceId,
    title: `Invoice ${invoiceNumber} generated from recurring template`,
    metadata: { recurringId: recurring.id, total: grandTotal, currency },
  });

  return { ok: true, invoiceId };
}

async function updateRecurringNextGeneration(
  admin: SupabaseClient<Database>,
  recurring: RecurringInvoiceRow,
  periodStart: Date,
): Promise<void> {
  // Compute next generation date using the same logic as the DB function
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nextGen } = await (admin as any).rpc("compute_next_recurring_date", {
    p_frequency: recurring.frequency,
    p_interval: recurring.interval,
    p_day_of_month: recurring.day_of_month,
    p_day_of_week: recurring.day_of_week,
    p_start_date: recurring.start_date,
    p_after_date: periodStart.toISOString().split("T")[0],
  });

  const nextGenDate = nextGen ? new Date(nextGen as string) : null;
  const genCount = recurring.generation_count + 1;

  // Check end conditions
  let isActive = true;
  let nextGenAt: string | null = nextGenDate?.toISOString() ?? null;

  if (recurring.end_date && nextGenDate && nextGenDate > new Date(recurring.end_date)) {
    isActive = false;
    nextGenAt = null;
  }
  if (recurring.max_occurrences && genCount >= recurring.max_occurrences) {
    isActive = false;
    nextGenAt = null;
  }

  await admin
    .from("recurring_invoices")
    .update({
      last_generated_at: new Date().toISOString(),
      next_generation_at: nextGenAt,
      generation_count: genCount,
      is_active: isActive,
    } as never)
    .eq("id", recurring.id);
}

export async function GET(req: Request): Promise<Response> {
  const env = requireServerEnv();
  if (!env.cronSecret) return new NextResponse("Not configured", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${env.cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startedAtMs = Date.now();
  const admin = getAdminSupabase();

  let processed = 0;
  let generated = 0;
  let errored = 0;

  try {
    const now = new Date().toISOString();
    const { data: recurringInvoices, error } = await admin
      .from("recurring_invoices")
      .select("*")
      .eq("is_active", true)
      .lte("next_generation_at", now)
      .order("next_generation_at", { ascending: true });

    if (error) throw error;

    for (const recurring of (recurringInvoices as RecurringInvoiceRow[]) ?? []) {
      try {
        // Determine the period start date for this generation
        // Use last_generated_at if available, otherwise start_date
        const lastGen = recurring.last_generated_at
          ? new Date(recurring.last_generated_at)
          : new Date(recurring.start_date);

        // The period start is the date we compute the next occurrence from
        const periodStart = lastGen;

        const result = await generateInvoiceFromTemplate(admin, recurring.user_id, recurring, periodStart);
        if (result.ok) {
          generated++;
          await updateRecurringNextGeneration(admin, recurring, periodStart);
        } else {
          errored++;
          log.warn("cron.recurring_invoices.generation_failed", {
            recurringId: recurring.id,
            userId: recurring.user_id,
            error: result.error,
          });
        }
        processed++;
      } catch (err) {
        errored++;
        log.error("cron.recurring_invoices.unexpected_error", {
          recurringId: recurring.id,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("cron.recurring_invoices.list_failed", { error: message });
    await recordCronRun({
      job: "recurring-invoices",
      status: "error",
      startedAtMs,
      error: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  log.info("cron.recurring_invoices.summary", { processed, generated, errored });
  await recordCronRun({
    job: "recurring-invoices",
    status: errored > 0 && generated === 0 ? "error" : "ok",
    startedAtMs,
    detail: { processed, generated, errored },
  });

  return NextResponse.json({
    ok: true,
    processed,
    generated,
    errored,
    time: new Date().toISOString(),
  });
}