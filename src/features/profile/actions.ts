"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { normaliseGstin } from "@/features/gst/validation";
import { requireFeature } from "@/features/subscription/server";
import {
  addressSchema,
  brandingSchema,
  businessDetailsSchema,
  invoiceDefaultsSchema,
  notificationPreferencesSchema,
  localizationSchema,
  personalProfileSchema,
  signatureSchema,
  taxInfoSchema,
  type AddressInput,
  type BrandingInput,
  type BusinessDetailsInput,
  type InvoiceDefaultsInput,
  type LocalizationInput,
  type NotificationPreferencesInput,
  type PersonalProfileInput,
  type SignatureInput,
  type TaxInfoInput,
} from "./schemas";
import { getProfile } from "./server";

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

function flatErrors<T>(result: { error: { flatten(): { fieldErrors: Record<string, string[]> } } }): ActionResult<T> {
  const flat = result.error.flatten();
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: flat.fieldErrors,
  };
}

async function refreshProfileResponse(message?: string): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const profile = await getProfile();
  return { ok: true, data: { profile }, message };
}

export async function updatePersonalProfile(
  input: PersonalProfileInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = personalProfileSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  if (parsed.data.email) {
    const { error: authError } = await supabase.auth.updateUser({
      email: parsed.data.email,
    });
    if (authError) return { ok: false, error: authError.message };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: parsed.data.fullName,
      display_name: parsed.data.displayName ?? null,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      role: parsed.data.role ?? null,
      bio: parsed.data.bio ?? null,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Profile updated.");
}

export async function updateLocalization(
  input: LocalizationInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = localizationSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      default_currency: parsed.data.defaultCurrency,
      timezone: parsed.data.timezone,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Localization updated.");
}

export async function updateBusinessDetails(
  input: BusinessDetailsInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = businessDetailsSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      business_name: parsed.data.businessName ?? null,
      legal_name: parsed.data.legalName ?? null,
      business_type: parsed.data.businessType,
      business_email: parsed.data.businessEmail ?? null,
      business_phone: parsed.data.businessPhone ?? null,
      website: parsed.data.website ?? null,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Business details updated.");
}

export async function updateTaxInfo(
  input: TaxInfoInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = taxInfoSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const patch = parsed.data.gstRegistered
    ? {
        gst_registered: true,
        gstin: normaliseGstin(parsed.data.gstin),
        pan: parsed.data.pan ?? null,
        state_code: parsed.data.stateCode ?? null,
        country: parsed.data.country,
      }
    : {
        gst_registered: false,
        gstin: null,
        pan: parsed.data.pan ?? null,
        state_code: parsed.data.stateCode ?? null,
        country: parsed.data.country,
      };

  const { error } = await supabase
    .from("user_profiles")
    .update(patch as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Tax info updated.");
}

export async function updateBusinessAddress(
  input: AddressInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      address_line1: parsed.data.addressLine1 ?? null,
      address_line2: parsed.data.addressLine2 ?? null,
      city: parsed.data.city ?? null,
      state_code: parsed.data.stateCode ?? null,
      postal_code: parsed.data.postalCode ?? null,
      country: parsed.data.country,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Address updated.");
}

export async function updateBranding(
  input: BrandingInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  await requireFeature("invoices.custom_branding");
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      brand_color: parsed.data.brandColor ?? null,
      brand_tagline: parsed.data.brandTagline ?? null,
      brand_signature: parsed.data.brandSignature ?? null,
      brand_intro: parsed.data.brandIntro ?? null,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Branding updated.");
}

export async function updateSignature(
  input: SignatureInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
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
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  revalidatePath("/onboarding", "layout");
  return refreshProfileResponse("Signature updated.");
}

export async function updateInvoiceDefaults(
  input: InvoiceDefaultsInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = invoiceDefaultsSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();
  const { data: profileRow } = await supabase
    .from("user_profiles")
    .select("gst_registered")
    .eq("id", userId)
    .maybeSingle();
  const gstRegistered =
    ((profileRow as { gst_registered?: boolean } | null)?.gst_registered ?? false) === true;

  const { error } = await supabase
    .from("user_profiles")
    .update({
      invoice_prefix: parsed.data.invoicePrefix,
      invoice_next_number: parsed.data.invoiceNextNumber,
      invoice_number_padding: parsed.data.invoiceNumberPadding,
      invoice_reset_yearly: parsed.data.invoiceResetYearly,
      invoice_default_tax_mode: gstRegistered
        ? parsed.data.invoiceDefaultTaxMode
        : "intra",
      invoice_default_gst_rate: gstRegistered
        ? parsed.data.invoiceDefaultGstRate
        : 0,
      invoice_default_due_days: parsed.data.invoiceDefaultDueDays,
      invoice_default_notes: parsed.data.invoiceDefaultNotes ?? null,
      invoice_default_terms: parsed.data.invoiceDefaultTerms ?? null,
      invoice_default_hsn_sac: parsed.data.invoiceDefaultHsnSac ?? null,
      default_currency: parsed.data.defaultCurrency,
      invoice_send_reminders: parsed.data.invoiceSendReminders,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/invoices", "layout");
  revalidatePath("/dashboard/settings", "layout");
  return refreshProfileResponse("Invoice defaults updated.");
}

export async function updateNotificationPreferences(
  input: NotificationPreferencesInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = notificationPreferencesSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      notification_preferences: parsed.data,
    } as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  revalidatePath("/dashboard/notifications");
  return refreshProfileResponse("Notification preferences saved.");
}
