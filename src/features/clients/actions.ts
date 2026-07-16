"use server";

/**
 * Server actions for the persistent client CRUD module.
 *
 * Validation: `clientCrudSchema` (Zod) — same shape on client + server.
 * Authorisation: Supabase RLS — every query runs scoped to `auth.uid()`.
 * Free-plan: `assertCanCreateClient()` runs before insertion.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { coerceFormValues } from "@/lib/form";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { normaliseGstin } from "@/features/gst/validation";
import { clientCrudSchema, clientIdSchema } from "./server-schemas";
import { isValidStateCode } from "@/features/gst/state-codes";
import { assertCanCreateClient } from "./enforcement";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      reason?: "limit_exceeded";
    };

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function parseFromFormData(formData: FormData) {
  return clientCrudSchema.safeParse(
    coerceFormValues({
      gstRegistered: formData.get("gstRegistered") === "true",
      fullName: formData.get("fullName"),
      businessName: formData.get("businessName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      country: formData.get("country") ?? undefined,
      currency: formData.get("currency") ?? undefined,
      locale: formData.get("locale") ?? undefined,
      stateCode: formData.get("stateCode") ?? "",
      billingAddress: formData.get("billingAddress") ?? "",
      notes: formData.get("notes"),
      gstin: formData.get("gstin") ?? "",
    }),
  );
}

// --- Create -----------------------------------------------------------------

export async function createClientAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseFromFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Free-plan check FIRST — fail loudly before mutating.
  const blocked = await assertCanCreateClient();
  if (blocked) {
    return {
      ok: false,
      error: blocked.error,
      reason: "limit_exceeded",
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const isForeign = parsed.data.country !== "IN";
  // Indian (non-foreign) clients still need a valid state for place-of-supply.
  if (!isForeign && !isValidStateCode(parsed.data.stateCode ?? "")) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { stateCode: ["Pick a valid Indian state"] },
    };
  }

  const insertRow = {
    user_id: userId,
    full_name: parsed.data.fullName,
    business_name: parsed.data.businessName ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    country: parsed.data.country,
    currency: parsed.data.currency,
    locale: parsed.data.locale ?? null,
    is_foreign: isForeign,
    gst_registered: parsed.data.gstRegistered,
    gst_number: parsed.data.gstRegistered
      ? normaliseGstin(parsed.data.gstin)
      : null,
    state_code: isForeign ? null : parsed.data.stateCode,
    billing_address: parsed.data.billingAddress ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { data, error } = await supabase
    .from("clients")
    .insert(insertRow as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not save client." };
  }

  revalidatePath("/dashboard/clients");
  return {
    ok: true,
    data: { id: (data as { id: string }).id },
    message: "Client created.",
  };
}

// --- Update -----------------------------------------------------------------

export async function updateClientAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = clientIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) {
    return { ok: false, error: "Missing or invalid client id." };
  }

  const parsed = parseFromFormData(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  await requireUserId();
  const supabase = await getServerSupabase();

  const isForeign = parsed.data.country !== "IN";
  if (!isForeign && !isValidStateCode(parsed.data.stateCode ?? "")) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { stateCode: ["Pick a valid Indian state"] },
    };
  }

  const update = {
    full_name: parsed.data.fullName,
    business_name: parsed.data.businessName ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    country: parsed.data.country,
    currency: parsed.data.currency,
    locale: parsed.data.locale ?? null,
    is_foreign: isForeign,
    gst_registered: parsed.data.gstRegistered,
    gst_number: parsed.data.gstRegistered
      ? normaliseGstin(parsed.data.gstin)
      : null,
    state_code: isForeign ? null : parsed.data.stateCode,
    billing_address: parsed.data.billingAddress ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { error } = await supabase
    .from("clients")
    .update(update as never)
    .eq("id", idParse.data);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${idParse.data}`);
  return { ok: true, message: "Client updated." };
}

// --- Delete -----------------------------------------------------------------

export async function deleteClientAction(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const idParse = clientIdSchema.safeParse(formData.get("id"));
  if (!idParse.success) {
    return { ok: false, error: "Missing or invalid client id." };
  }
  await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase.from("clients").delete().eq("id", idParse.data);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/clients");
  return { ok: true, message: "Client deleted." };
}

/**
 * Clear the `needs_review` flag once the freelancer has verified the details
 * of a client that was auto-created from a lead form.
 */
export async function markClientReviewedAction(input: {
  id: string;
}): Promise<ActionResult> {
  const idParse = clientIdSchema.safeParse(input.id);
  if (!idParse.success) return { ok: false, error: "Invalid client id." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ needs_review: false } as never)
    .eq("id", idParse.data)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clients/${idParse.data}`);
  revalidatePath("/dashboard/clients");
  return { ok: true, message: "Client marked as verified." };
}

// --- CSV bulk import -------------------------------------------------------

export interface CsvClientRow {
  fullName: string;
  businessName?: string;
  email?: string;
  phone?: string;
}

export interface ImportClientsResult {
  ok: boolean;
  imported: number;
  skipped: number;
  blocked: boolean;
  error?: string;
}

/**
 * Bulk-imports clients from a parsed CSV row array.
 *
 * - Rows with no `fullName` are silently skipped.
 * - Runs the free-plan `assertCanCreateClient` check before every
 *   insertion and stops the batch early if the limit is reached.
 * - Non-GST only: CSV imports never set `gst_registered = true` because
 *   GSTIN + state validation can't be inferred from a flat CSV row.
 * - Max 200 rows per call.
 */
export async function importClientsAction(
  rows: CsvClientRow[],
): Promise<ImportClientsResult> {
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const validRows = rows
    .slice(0, 200)
    .filter((r) => r.fullName?.trim().length > 0);

  if (validRows.length === 0) {
    return { ok: false, imported: 0, skipped: 0, blocked: false, error: "No valid rows found." };
  }

  let imported = 0;
  let skipped = 0;
  let blocked = false;

  for (const row of validRows) {
    // Check limit before every insert so we don't blow past the cap.
    const limitCheck = await assertCanCreateClient();
    if (limitCheck) {
      blocked = true;
      break;
    }

    const { error } = await supabase.from("clients").insert({
      user_id: userId,
      full_name: row.fullName.trim(),
      business_name: row.businessName?.trim() || null,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      gst_registered: false,
      gst_number: null,
      state_code: null,
      billing_address: null,
      notes: null,
    } as never);

    if (error) {
      skipped += 1;
    } else {
      imported += 1;
    }
  }

  revalidatePath("/dashboard/clients");

  return {
    ok: true,
    imported,
    skipped,
    blocked,
  };
}
