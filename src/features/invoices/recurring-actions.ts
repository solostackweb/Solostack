"use server";

/**
 * Server actions for recurring invoice templates.
 *
 * Flow:
 *   1. Validate the form payload (Zod) — same schema as the client form.
 *   2. Resolve seller (current user) + client GST status for tax mode.
 *   3. Persist the recurring template with computed next_generation_at.
 *   4. Cron job (separate route) picks up due templates and generates invoices.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { coerceFormValues } from "@/lib/form";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import {
  recurringInvoiceFormSchema,
  type RecurringInvoiceFormValues,
  type RecurringFrequency,
} from "./schema";
import { recordActivity } from "@/features/activity/server";
import { compute_next_recurring_date } from "@/lib/supabase/rpc";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function readPayload(formData: FormData): Partial<RecurringInvoiceFormValues> {
  const raw = formData.get("payload");
  if (typeof raw === "string" && raw.length > 0) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return coerceFormValues({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    frequency: formData.get("frequency"),
    interval: formData.get("interval"),
    dayOfMonth: formData.get("dayOfMonth"),
    dayOfWeek: formData.get("dayOfWeek"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    maxOccurrences: formData.get("maxOccurrences"),
    currency: formData.get("currency") ?? "INR",
    issueDateOffset: formData.get("issueDateOffset") ?? 0,
    dueDateOffset: formData.get("dueDateOffset") ?? 14,
    statusOnCreate: formData.get("statusOnCreate") ?? "draft",
    discount: formData.get("discount") ?? 0,
    notes: formData.get("notes"),
    terms: formData.get("terms"),
    hsnSac: formData.get("hsnSac"),
    gstRate: formData.get("gstRate") ?? 0,
    items: [],
    invoicePrefix: formData.get("invoicePrefix"),
    invoiceNumberPadding: formData.get("invoiceNumberPadding"),
  }) as Partial<RecurringInvoiceFormValues>;
}

function itemsFromForm(formData: FormData): RecurringInvoiceFormValues["items"] {
  const raw = formData.get("items");
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

// --- Create ------------------------------------------------------------------

export async function createRecurringInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = recurringInvoiceFormSchema.safeParse({
    ...readPayload(formData),
    items: itemsFromForm(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Compute next_generation_at from start_date
  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const nextGen = await compute_next_recurring_date(
    data.frequency,
    data.interval,
    data.dayOfMonth ?? null,
    data.dayOfWeek ?? null,
    startDate,
    startDate,
  );

  const insertRow = {
    user_id: userId,
    client_id: data.clientId ?? null,
    project_id: data.projectId ?? null,
    frequency: data.frequency,
    interval: data.interval,
    day_of_month: data.dayOfMonth,
    day_of_week: data.dayOfWeek,
    start_date: data.startDate,
    end_date: data.endDate ?? null,
    max_occurrences: data.maxOccurrences ?? null,
    invoice_prefix: data.invoicePrefix?.trim() || null,
    invoice_number_padding: data.invoiceNumberPadding ?? null,
    currency: data.currency,
    issue_date_offset: data.issueDateOffset,
    due_date_offset: data.dueDateOffset,
    status_on_create: data.statusOnCreate,
    discount: data.discount,
    notes: data.notes ?? null,
    terms: data.terms ?? null,
    hsn_sac: data.hsnSac?.trim() || null,
    gst_rate: data.gstRate,
    items: data.items as never,
    next_generation_at: nextGen.toISOString(),
    generation_count: 0,
    is_active: true,
  };

  const { data: result, error } = await supabase
    .from("recurring_invoices")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error || !result) {
    return { ok: false, error: error?.message ?? "Could not save recurring invoice." };
  }

  await recordActivity({
    kind: "recurring_invoice_created",
    entityType: "recurring_invoice",
    entityId: (result as { id: string }).id,
    title: `Created recurring invoice template (${data.frequency})`,
    metadata: { frequency: data.frequency, interval: data.interval },
  });

  revalidatePath("/dashboard/invoices/recurring");
  return {
    ok: true,
    data: { id: (result as { id: string }).id },
    message: "Recurring invoice created.",
  };
}

// --- List --------------------------------------------------------------------

export interface RecurringInvoiceListItem {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  frequency: RecurringFrequency;
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
  paused_at: string | null;
  created_at: string;
}

export async function listRecurringInvoices(): Promise<RecurringInvoiceListItem[]> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("recurring_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as never as RecurringInvoiceListItem[]);
}

export async function getRecurringInvoice(id: string): Promise<RecurringInvoiceListItem | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("recurring_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as never as RecurringInvoiceListItem;
}

// --- Update ------------------------------------------------------------------

export async function updateRecurringInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing recurring invoice id." };
  }

  const parsed = recurringInvoiceFormSchema.safeParse({
    ...readPayload(formData),
    items: itemsFromForm(formData),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Verify ownership
  const { data: existing } = await supabase
    .from("recurring_invoices")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "Recurring invoice not found." };

  const data = parsed.data;
  const startDate = new Date(data.startDate);
  const nextGen = await compute_next_recurring_date(
    data.frequency,
    data.interval,
    data.dayOfMonth ?? null,
    data.dayOfWeek ?? null,
    startDate,
    startDate,
  );

  const update = {
    client_id: data.clientId ?? null,
    project_id: data.projectId ?? null,
    frequency: data.frequency,
    interval: data.interval,
    day_of_month: data.dayOfMonth,
    day_of_week: data.dayOfWeek,
    start_date: data.startDate,
    end_date: data.endDate ?? null,
    max_occurrences: data.maxOccurrences ?? null,
    invoice_prefix: data.invoicePrefix?.trim() || null,
    invoice_number_padding: data.invoiceNumberPadding ?? null,
    currency: data.currency,
    issue_date_offset: data.issueDateOffset,
    due_date_offset: data.dueDateOffset,
    status_on_create: data.statusOnCreate,
    discount: data.discount,
    notes: data.notes ?? null,
    terms: data.terms ?? null,
    hsn_sac: data.hsnSac?.trim() || null,
    gst_rate: data.gstRate,
    items: data.items as never,
    next_generation_at: nextGen.toISOString(),
  };

  const { error } = await supabase
    .from("recurring_invoices")
    .update(update as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/invoices/recurring");
  return { ok: true, message: "Recurring invoice updated." };
}

// --- Delete ------------------------------------------------------------------

export async function deleteRecurringInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing recurring invoice id." };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("recurring_invoices")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/invoices/recurring");
  return { ok: true, message: "Recurring invoice deleted." };
}

// --- Pause / Resume ----------------------------------------------------------

export async function pauseRecurringInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing recurring invoice id." };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("recurring_invoices")
    .update({ is_active: false, paused_at: new Date().toISOString() } as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/invoices/recurring");
  return { ok: true, message: "Recurring invoice paused." };
}

export async function resumeRecurringInvoiceAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { ok: false, error: "Missing recurring invoice id." };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Recompute next_generation_at from now
  const { data: existing } = await supabase
    .from("recurring_invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Recurring invoice not found." };

  const row = existing as {
    frequency: RecurringFrequency;
    interval: number;
    day_of_month: number | null;
    day_of_week: number | null;
    start_date: string;
  };

  const nextGen = await compute_next_recurring_date(
    row.frequency,
    row.interval,
    row.day_of_month,
    row.day_of_week,
    new Date(row.start_date),
    new Date(),
  );

  const { error } = await supabase
    .from("recurring_invoices")
    .update({
      is_active: true,
      paused_at: null,
      next_generation_at: nextGen.toISOString(),
    } as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/invoices/recurring");
  return { ok: true, message: "Recurring invoice resumed." };
}