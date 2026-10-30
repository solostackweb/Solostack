"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { AUTH_LOGIN_ROUTE } from "@/features/auth/routes";
import { normaliseGstin } from "@/features/gst/validation";
import { requireFeature } from "@/features/subscription/server";
import { getClientIp, leadSubmitLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/features/email/service";
import { renderLeadCapturedEmail } from "@/features/email/templates";
import { env } from "@/config/env";
import { z } from "zod";
import {
  addressSchema,
  brandingSchema,
  businessDetailsSchema,
  invoiceDefaultsSchema,
  notificationPreferencesSchema,
  localizationSchema,
  personalProfileSchema,
  portfolioItemSchema,
  publicProfileSchema,
  slugSchema,
  signatureSchema,
  taxInfoSchema,
  type AddressInput,
  type BrandingInput,
  type BusinessDetailsInput,
  type InvoiceDefaultsInput,
  type LocalizationInput,
  type NotificationPreferencesInput,
  type PersonalProfileInput,
  type PortfolioItemInput,
  type PublicProfileInput,
  type SignatureInput,
  type TaxInfoInput,
} from "./schemas";
import { getProfile } from "./server";
import { getPublicProfileStats } from "./public-profile-server";

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

export async function getCurrentPublicProfileStats() {
  const userId = await requireUserId();
  return getPublicProfileStats(userId);
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

// ============================================================================
// Public Profile Actions
// ============================================================================

async function revalidatePublicPage(userId: string): Promise<void> {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from("user_profiles")
    .select("public_slug, public_profile_enabled")
    .eq("id", userId)
    .maybeSingle();
  const row = data as { public_slug: string | null; public_profile_enabled: boolean | null } | null;
  if (row?.public_slug && row.public_profile_enabled) {
    revalidatePath(`/p/${row.public_slug}`);
  }
}

export async function updatePublicProfile(
  input: PublicProfileInput,
): Promise<ActionResult<{ profile: Awaited<ReturnType<typeof getProfile>> }>> {
  const parsed = publicProfileSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  // Check slug availability if changing
  if (parsed.data.publicSlug) {
    const admin = getAdminSupabase();
    const { data: available } = await admin.rpc("check_slug_available", {
      p_slug: parsed.data.publicSlug,
      p_exclude_user_id: userId,
    } as never);
    if (!available) {
      return { ok: false, error: "This slug is already taken or reserved." };
    }
  }

  const updateData: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.publicSlug !== undefined) updateData.public_slug = d.publicSlug || null;
  if (d.publicProfileEnabled !== undefined) updateData.public_profile_enabled = d.publicProfileEnabled;
  if (d.publicBio !== undefined) updateData.public_bio = d.publicBio;
  if (d.publicServices !== undefined) updateData.public_services = d.publicServices;
  if (d.publicIndustries !== undefined) updateData.public_industries = d.publicIndustries;
  if (d.publicLocation !== undefined) updateData.public_location = d.publicLocation;
  if (d.publicLanguages !== undefined) updateData.public_languages = d.publicLanguages;
  if (d.publicAvailability !== undefined) updateData.public_availability = d.publicAvailability;
  if (d.publicStartingRate !== undefined) updateData.public_starting_rate = d.publicStartingRate ?? null;
  if (d.publicStartingRateCurrency !== undefined) updateData.public_starting_rate_currency = d.publicStartingRateCurrency;
  if (d.publicShowReviews !== undefined) updateData.public_show_reviews = d.publicShowReviews;
  if (d.publicShowPortfolio !== undefined) updateData.public_show_portfolio = d.publicShowPortfolio;
  if (d.publicShowStats !== undefined) updateData.public_show_stats = d.publicShowStats;
  if (d.publicCtaText !== undefined) updateData.public_cta_text = d.publicCtaText;
  if (d.publicCtaAction !== undefined) updateData.public_cta_action = d.publicCtaAction;
  if (d.publicCustomDomain !== undefined) updateData.public_custom_domain = d.publicCustomDomain;
  if (d.publicSeoTitle !== undefined) updateData.public_seo_title = d.publicSeoTitle;
  if (d.publicSeoDescription !== undefined) updateData.public_seo_description = d.publicSeoDescription;
  if (d.publicOgImage !== undefined) updateData.public_og_image = d.publicOgImage;

  const { error } = await supabase
    .from("user_profiles")
    .update(updateData as never)
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  if (parsed.data.publicSlug) {
    revalidatePath(`/p/${parsed.data.publicSlug}`);
  }
  await revalidatePublicPage(userId);
  return refreshProfileResponse("Public profile updated.");
}

export async function checkPublicSlugAction(
  slug: string
): Promise<{ ok: true; data: { available: boolean } } | { ok: false; error: string }> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return { ok: false, error: "Invalid slug format." };
  }

  const userId = await requireUserId();
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("check_slug_available", {
    p_slug: parsed.data,
    p_exclude_user_id: userId,
  } as never);

  return { ok: true, data: { available: data ?? false } };
}

export async function claimPublicSlugAction(
  slug: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return { ok: false, error: "Invalid slug format." };
  }

  const userId = await requireUserId();
  const admin = getAdminSupabase();
  const { data } = await admin.rpc("claim_public_slug", {
    p_user_id: userId,
    p_slug: parsed.data,
  } as never);

  if (!data) {
    return { ok: false, error: "Could not claim slug. It may be taken or reserved." };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/settings", "layout");
  revalidatePath(`/p/${parsed.data}`);
  return { ok: true, message: "Public profile URL claimed!" };
}

// ============================================================================
// Portfolio Actions
// ============================================================================

export async function createPortfolioItemAction(
  input: PortfolioItemInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = portfolioItemSchema.safeParse(input);
  if (!parsed.success) return flatErrors(parsed);

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from("public_portfolio_items")
    .insert({
      user_id: userId,
      project_id: parsed.data.projectId ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      cover_image_url: parsed.data.coverImageUrl,
      images: parsed.data.images,
      category: parsed.data.category,
      industry: parsed.data.industry,
      budget_range: parsed.data.budgetRange,
      duration: parsed.data.duration,
      technologies: parsed.data.technologies,
      client_name: parsed.data.clientName,
      client_industry: parsed.data.clientIndustry,
      testimonial: parsed.data.testimonial,
      featured: parsed.data.featured,
      sort_order: parsed.data.sortOrder,
      published: parsed.data.published,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create portfolio item." };
  }

  revalidatePath("/dashboard/settings/profile/public");
  await revalidatePublicPage(userId);
  return { ok: true, data: { id: (data as { id: string }).id }, message: "Portfolio item created." };
}

const updatePortfolioItemSchema = portfolioItemSchema.extend({ id: z.string().uuid() });

export async function updatePortfolioItemAction(
  input: PortfolioItemInput & { id: string },
): Promise<ActionResult> {
  const parsed = updatePortfolioItemSchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { id, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (rest.projectId !== undefined) updateData.project_id = rest.projectId ?? null;
  if (rest.title !== undefined) updateData.title = rest.title;
  if (rest.description !== undefined) updateData.description = rest.description;
  if (rest.coverImageUrl !== undefined) updateData.cover_image_url = rest.coverImageUrl;
  if (rest.images !== undefined) updateData.images = rest.images;
  if (rest.category !== undefined) updateData.category = rest.category;
  if (rest.industry !== undefined) updateData.industry = rest.industry;
  if (rest.budgetRange !== undefined) updateData.budget_range = rest.budgetRange;
  if (rest.duration !== undefined) updateData.duration = rest.duration;
  if (rest.technologies !== undefined) updateData.technologies = rest.technologies;
  if (rest.clientName !== undefined) updateData.client_name = rest.clientName;
  if (rest.clientIndustry !== undefined) updateData.client_industry = rest.clientIndustry;
  if (rest.testimonial !== undefined) updateData.testimonial = rest.testimonial;
  if (rest.featured !== undefined) updateData.featured = rest.featured;
  if (rest.sortOrder !== undefined) updateData.sort_order = rest.sortOrder;
  if (rest.published !== undefined) updateData.published = rest.published;

  const { error } = await supabase
    .from("public_portfolio_items")
    .update(updateData as never)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/profile/public");
  await revalidatePublicPage(userId);
  return { ok: true, message: "Portfolio item updated." };
}

export async function deletePortfolioItemAction(
  id: string
): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid portfolio item ID." };

  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  const { error } = await supabase
    .from("public_portfolio_items")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings/profile/public");
  await revalidatePublicPage(userId);
  return { ok: true, message: "Portfolio item deleted." };
}

export async function reorderPortfolioItemsAction(
  items: Array<{ id: string; sortOrder: number }>
): Promise<ActionResult> {
  const userId = await requireUserId();
  const supabase = await getServerSupabase();

  for (const item of items) {
    const { error } = await supabase
      .from("public_portfolio_items")
      .update({ sort_order: item.sortOrder } as never)
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/profile/public");
  await revalidatePublicPage(userId);
  return { ok: true, message: "Portfolio reordered." };
}

// ============================================================================
// Public Enquiry → Lead (no login required)
// ============================================================================

const profileEnquirySchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(180),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  project: z.string().trim().min(10, "Tell us a little more about the project").max(3000),
  budget: z.string().trim().max(120).optional().or(z.literal("")),
  timeline: z.string().trim().max(160).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
});

export type ProfileEnquiryInput = z.infer<typeof profileEnquirySchema>;

/**
 * Public "Start a project" enquiry on /p/[slug]. Creates a lead the same way
 * a lead-form submission does (client flagged needs_review + lead project +
 * owner email + in-app notification) but without requiring a lead_forms row —
 * lead_submissions.form_id is NOT NULL, so no submission row is written.
 */
export async function submitProfileEnquiryAction(
  input: ProfileEnquiryInput,
): Promise<ActionResult<{ projectId: string }>> {
  // Honeypot — bots fill it, real users never see it. Pretend success.
  if (input.website?.trim()) {
    return { ok: true, message: "Thanks. Your enquiry has been sent." };
  }

  const rl = await leadSubmitLimit(await getClientIp());
  if (!rl.ok) {
    return { ok: false, error: rl.message };
  }

  const parsed = profileEnquirySchema.safeParse(input);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }

  const admin = getAdminSupabase();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, public_profile_enabled")
    .eq("public_slug", parsed.data.slug)
    .maybeSingle();
  const owner = profile as { id: string; public_profile_enabled: boolean | null } | null;
  if (!owner || !owner.public_profile_enabled) {
    return { ok: false, error: "This profile is not accepting enquiries right now." };
  }
  const ownerId = owner.id;

  const { data: existingClient } = await admin
    .from("clients")
    .select("id")
    .eq("user_id", ownerId)
    .ilike("email", parsed.data.email)
    .limit(1)
    .maybeSingle();

  let clientId: string;
  let clientIsNew = false;

  if (existingClient) {
    clientId = (existingClient as { id: string }).id;
  } else {
    const { data: client, error: clientError } = await admin
      .from("clients")
      .insert({
        user_id: ownerId,
        full_name: parsed.data.name,
        business_name: parsed.data.company || null,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        country: "IN",
        currency: "INR",
        is_foreign: false,
        gst_registered: false,
        state_code: null,
        billing_address: null,
        needs_review: true,
        notes: [
          `Created from public profile enquiry (/p/${parsed.data.slug}).`,
          "Verify billing address, GST status, state, and document details before sending proposals, contracts, or invoices.",
        ].join("\n"),
      } as never)
      .select("id")
      .single();

    if (clientError || !client) {
      return { ok: false, error: clientError?.message ?? "Could not send your enquiry." };
    }
    clientId = (client as { id: string }).id;
    clientIsNew = true;
  }

  const projectName = parsed.data.company
    ? `${parsed.data.company} inquiry`
    : `${parsed.data.name} inquiry`;
  const description = [
    parsed.data.project,
    parsed.data.budget ? `Budget: ${parsed.data.budget}` : null,
    parsed.data.timeline ? `Timeline: ${parsed.data.timeline}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: project, error: projectError } = await admin
    .from("projects")
    .insert({
      user_id: ownerId,
      client_id: clientId,
      name: projectName,
      description,
      status: "lead",
      billing_enabled: false,
      hourly_rate: 0,
    } as never)
    .select("id")
    .single();

  if (projectError || !project) {
    return { ok: false, error: projectError?.message ?? "Could not send your enquiry." };
  }
  const projectId = (project as { id: string }).id;

  await admin.from("project_status_history").insert({
    project_id: projectId,
    user_id: ownerId,
    from_status: null,
    to_status: "lead",
    note: "Created from public profile enquiry",
    changed_by: ownerId,
  } as never);

  try {
    const { data: ownerProfile } = await admin
      .from("user_profiles")
      .select("email, business_email, business_name, full_name")
      .eq("id", ownerId)
      .maybeSingle();
    const ownerRow = ownerProfile as
      | {
          email: string | null;
          business_email: string | null;
          business_name: string | null;
          full_name: string | null;
        }
      | null;
    const ownerEmail = ownerRow?.business_email || ownerRow?.email;
    if (ownerEmail) {
      const appUrl = env.appUrl.replace(/\/$/, "");
      const rendered = renderLeadCapturedEmail({
        formTitle: "Public profile enquiry",
        leadName: parsed.data.name,
        leadEmail: parsed.data.email,
        company: parsed.data.company || null,
        projectSummary: parsed.data.project,
        budget: parsed.data.budget || null,
        timeline: parsed.data.timeline || null,
        dashboardUrl: `${appUrl}/dashboard/clients/${clientId}`,
      });
      await sendEmail({
        type: "share",
        to: {
          email: ownerEmail,
          name: ownerRow?.business_name || ownerRow?.full_name || undefined,
        },
        replyTo: { email: parsed.data.email, name: parsed.data.name },
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: ["lead-captured", "public-profile"],
      });
    }
  } catch {
    /* in-app notification below still lands */
  }

  await admin.from("notifications").insert({
    user_id: ownerId,
    title: clientIsNew
      ? "New enquiry from your public profile"
      : "New enquiry from an existing client",
    body: clientIsNew
      ? `${parsed.data.name} enquired via your public profile. Stackivo created a client and a lead project — verify details before sending documents.`
      : `${parsed.data.name} (${parsed.data.email}) enquired via your public profile. A new lead project was added under their existing client record.`,
    type: "lead",
    entity_type: "client",
    entity_id: clientId,
    href: `/dashboard/clients/${clientId}`,
  } as never);

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/clients");
  return {
    ok: true,
    data: { projectId },
    message: "Thanks. Your enquiry has been sent.",
  };
}
