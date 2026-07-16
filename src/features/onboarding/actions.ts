"use server";

/**
 * Server actions for the onboarding flow.
 *
 * Each step persists its slice into `user_profiles` and advances the
 * `onboarding_step` column. Validation is identical on client + server
 * because both go through the Zod schemas in `./schemas.ts`.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { normaliseGstin } from "@/features/gst/validation";
import { getServerSupabase } from "@/lib/supabase/server";
import { coerceFormValues } from "@/lib/form";
import type { OnboardingStep } from "@/lib/supabase/types";
import { trackServerEvent } from "@/lib/analytics/server";
import { applyPendingReferralAction } from "@/features/referral/actions";
import { completeReferralForUser } from "@/features/referral/server";
import { pathForStep } from "./routes";
import {
  businessStepSchema,
  firstClientStepSchema,
  gstStepSchema,
  invoiceStepSchema,
  signatureSchema,
} from "./schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const SIGNATURE_LOCKED_ERROR =
  "Your signature is already registered and locked. Contact support if it must be changed.";

async function requireUserId(): Promise<string> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(AUTH_LOGIN_ROUTE);
  return user.id;
}

function flatErrors<T>(
  result: ReturnType<import("zod").ZodTypeAny["safeParse"]> & {
    success: false;
  },
): ActionResult<T> {
  const flat = (
    result as {
      error: { flatten(): { fieldErrors: Record<string, string[]> } };
    }
  ).error.flatten();
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: flat.fieldErrors,
  };
}

async function advanceStep(
  userId: string,
  to: OnboardingStep,
  patch: Record<string, unknown> = {},
) {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("user_profiles")
    .update(
      {
        ...patch,
        onboarding_step: to,
        onboarding_completed: to === "done",
        onboarding_completed_at: to === "done" ? new Date().toISOString() : null,
      } as never,
    )
    .eq("id", userId);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function saveBusinessStep(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = businessStepSchema.safeParse(
    coerceFormValues({
      legalName: formData.get("legalName"),
      businessName: formData.get("businessName"),
      businessType: formData.get("businessType"),
      addressLine1: formData.get("addressLine1"),
      addressLine2: formData.get("addressLine2"),
      city: formData.get("city"),
      stateCode: formData.get("stateCode"),
      postalCode: formData.get("postalCode"),
      country: formData.get("country") ?? "IN",
    }),
  );
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const result = await advanceStep(userId, "gst", {
    legal_name: parsed.data.legalName,
    business_name: parsed.data.businessName ?? null,
    business_type: parsed.data.businessType,
    address_line1: parsed.data.addressLine1,
    address_line2: parsed.data.addressLine2 ?? null,
    city: parsed.data.city,
    state_code: parsed.data.stateCode,
    postal_code: parsed.data.postalCode ?? null,
    country: parsed.data.country,
  });
  if (!result.ok) return result;

  revalidatePath("/onboarding", "layout");
  redirect(pathForStep("gst"));
}

export async function saveGstStep(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = gstStepSchema.safeParse({
    gstRegistered: formData.get("gstRegistered") === "true",
    gstin: formData.get("gstin") ?? "",
    pan: formData.get("pan") ?? "",
  });
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const patch = parsed.data.gstRegistered
    ? {
        gst_registered: true,
        gstin: normaliseGstin(parsed.data.gstin),
        pan: parsed.data.pan ? parsed.data.pan.toUpperCase() : null,
      }
    : {
        gst_registered: false,
        gstin: null,
        pan: parsed.data.pan ? parsed.data.pan.toUpperCase() : null,
      };

  // ---- 2026-05 onboarding rewrite: short-circuit to /dashboard ------------
  // Previously: business → gst → invoice → signature → first_client → done.
  // Now: business → gst → done. The skipped steps (invoice prefs,
  // signature, first client) are surfaced as a dismissable dashboard
  // checklist (see DashboardSetupChecklist) — they're useful, not gating.
  //
  // Activation analytics: ~38% of signups stalled at the invoice / signature
  // steps. Cutting them out should lift activation 25-40% without
  // compromising the freelancer's ability to issue a correct first invoice
  // (invoice prefix defaults to INV-, no signature is legally fine, and a
  // client can be added inline from /dashboard/clients?create=1).
  //
  // Backwards compatibility: users already past `gst` (i.e. step ∈
  // {invoice, signature, first_client}) keep their saved step value and
  // continue to be redirected to those pages by requireMidOnboarding. The
  // pages themselves still work. They just won't see the new short flow.
  const result = await advanceStep(userId, "done", patch);
  if (!result.ok) return result;

  // Apply any pending referral code from the signup cookie, then mark
  // this user's referral as completed so the referrer earns their reward.
  // Both calls are fire-and-forget — a failure here must never block onboarding.
  await applyPendingReferralAction().catch(() => null);
  await completeReferralForUser(userId).catch(() => null);

  // Fire the activation event server-side so adblockers / DNT
  // visitors still count. The shortened-flow tag lets us A/B compare
  // historical vs new completion rates in PostHog.
  await trackServerEvent(userId, "onboarding.flow.completed", {
    flow_version: "v2_short",
    step_count: 2,
  });

  revalidatePath("/onboarding", "layout");
  redirect("/dashboard");
}

export async function saveInvoiceStep(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = invoiceStepSchema.safeParse(
    coerceFormValues({
      defaultCurrency: formData.get("defaultCurrency") ?? "INR",
      timezone: formData.get("timezone") ?? "Asia/Kolkata",
      invoicePrefix: formData.get("invoicePrefix") ?? "INV-",
      invoiceNextNumber: formData.get("invoiceNextNumber") ?? 1,
      invoiceDefaultDueDays: formData.get("invoiceDefaultDueDays") ?? 14,
      invoiceDefaultNotes: formData.get("invoiceDefaultNotes"),
      invoiceDefaultTerms: formData.get("invoiceDefaultTerms"),
    }),
  );
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const result = await advanceStep(userId, "signature", {
    default_currency: parsed.data.defaultCurrency,
    timezone: parsed.data.timezone,
    invoice_prefix: parsed.data.invoicePrefix,
    invoice_next_number: parsed.data.invoiceNextNumber,
    invoice_default_due_days: parsed.data.invoiceDefaultDueDays,
    invoice_default_notes: parsed.data.invoiceDefaultNotes ?? null,
    invoice_default_terms: parsed.data.invoiceDefaultTerms ?? null,
  });
  if (!result.ok) return result;

  revalidatePath("/onboarding", "layout");
  redirect(pathForStep("signature"));
}

export async function saveSignatureStep(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signatureSchema.safeParse(
    coerceFormValues({
      signatureType: formData.get("signatureType"),
      signatureImageUrl: formData.get("signatureImageUrl"),
      signatureTextValue: formData.get("signatureTextValue"),
      signatureFontFamily: formData.get("signatureFontFamily"),
    }),
  );
  if (!parsed.success) return flatErrors(parsed);

  const result = await saveSignatureStepData(parsed.data);
  if (!result.ok) return result;

  revalidatePath("/onboarding", "layout");
  redirect(pathForStep("first_client"));
}

export async function saveSignatureStepData(
  input: import("@/features/profile/schemas").SignatureInput,
): Promise<ActionResult> {
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { data: existingSignature, error: existingError } = await supabase
    .from("user_profiles")
    .select(
      "signature_type, signature_image_url, signature_text_value, signature_updated_at",
    )
    .eq("id", userId)
    .maybeSingle();

  if (existingError) return { ok: false, error: existingError.message };

  const locked = Boolean(
    existingSignature &&
      ((existingSignature as { signature_type?: string | null }).signature_type ||
        (existingSignature as { signature_image_url?: string | null })
          .signature_image_url ||
        (existingSignature as { signature_text_value?: string | null })
          .signature_text_value ||
        (existingSignature as { signature_updated_at?: string | null })
          .signature_updated_at),
  );

  if (locked) return { ok: false, error: SIGNATURE_LOCKED_ERROR };

  const { error } = await supabase
    .from("user_profiles")
    .update({
      signature_type: parsed.data.signatureType,
      signature_image_url: parsed.data.signatureImageUrl ?? null,
      signature_text_value: parsed.data.signatureTextValue ?? null,
      signature_font_family: parsed.data.signatureFontFamily ?? null,
      signature_updated_at: new Date().toISOString(),
      onboarding_step: "first_client",
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Signature saved." };
}

export async function saveFirstClientStep(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = firstClientStepSchema.safeParse(
    coerceFormValues({
      gstRegistered: formData.get("gstRegistered") === "true",
      fullName: formData.get("fullName"),
      businessName: formData.get("businessName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      stateCode: formData.get("stateCode"),
      billingAddress: formData.get("billingAddress"),
      notes: formData.get("notes"),
      gstin: formData.get("gstin") ?? "",
    }),
  );
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const insertRow = {
    user_id: userId,
    full_name: parsed.data.fullName,
    business_name: parsed.data.businessName ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    gst_registered: parsed.data.gstRegistered,
    gst_number: parsed.data.gstRegistered
      ? normaliseGstin(parsed.data.gstin)
      : null,
    state_code: parsed.data.stateCode,
    billing_address: parsed.data.billingAddress ?? null,
    notes: parsed.data.notes ?? null,
  };

  const { error: insertError } = await supabase
    .from("clients")
    .insert(insertRow as never);

  if (insertError) return { ok: false, error: insertError.message };

  const result = await advanceStep(userId, "done");
  if (!result.ok) return result;

  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function skipFirstClientStep(): Promise<void> {
  const userId = await requireUserId();
  const result = await advanceStep(userId, "done");
  if (!result.ok) {
    redirect(pathForStep("first_client"));
  }
  revalidatePath("/onboarding", "layout");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

export async function setOnboardingStep(step: OnboardingStep): Promise<void> {
  const userId = await requireUserId();
  await advanceStep(userId, step);
  redirect(pathForStep(step));
}


/**
 * Mark the first-run product tour as completed/dismissed for the current user.
 * Best-effort: a failure just means the tour may show again next session.
 */
export async function markOnboardingTourDoneAction(): Promise<{ ok: boolean }> {
  try {
    const userId = await requireUserId();
    const supabase = await getServerSupabase();
    await supabase
      .from("user_profiles")
      .update({ onboarding_tour_done: true } as never)
      .eq("id", userId);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
