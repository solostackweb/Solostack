/**
 * Domain types for the onboarding + business-identity surface.
 *
 * Row-level types live in `@/lib/supabase/types`. This file contains the
 * higher-level view-models the rest of the app speaks in.
 */

import type {
  BusinessType,
  OnboardingStep,
  UserProfileRow,
} from "@/lib/supabase/types";

export type { BusinessType, OnboardingStep };

/**
 * The flat business profile consumed by UI + actions.
 *
 * Mirrors the columns on `user_profiles` minus auth/audit columns. Use
 * `mapProfileRow()` from `./server.ts` to produce one from a Supabase row.
 */
export interface BusinessProfile {
  userId: string;
  email: string;
  fullName: string;
  displayName: string | null;
  phone: string | null;
  role: string | null;
  bio: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  legalName: string | null;
  businessName: string | null;
  businessType: BusinessType | null;
  businessEmail: string | null;
  businessPhone: string | null;
  website: string | null;
  logoPath: string | null;
  logoUrl: string | null;
  brandIconPath: string | null;
  brandIconUrl: string | null;
  brandColor: string | null;
  brandTagline: string | null;
  brandSignature: string | null;
  brandIntro: string | null;
  signatureType: "draw" | "type" | "upload" | null;
  signatureImageUrl: string | null;
  signatureTextValue: string | null;
  signatureFontFamily: string | null;
  signatureUpdatedAt: string | null;

  // GST identity
  gstRegistered: boolean;
  gstin: string | null;
  pan: string | null;
  stateCode: string | null;

  // Address
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;

  // Locale + invoice prefs
  defaultCurrency: string;
  timezone: string;
  invoicePrefix: string | null;
  invoiceNextNumber: number;
  invoiceNumberPadding: number;
  invoiceResetYearly: boolean;
  invoiceDefaultTaxMode: "intra" | "inter";
  invoiceDefaultGstRate: number;
  invoiceDefaultHsnSac: string | null;
  invoiceSendReminders: boolean;
  invoiceDefaultDueDays: number;
  invoiceDefaultNotes: string | null;
  invoiceDefaultTerms: string | null;
  notificationPreferences: NotificationPreferences;

  // Onboarding
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  onboardingStep: OnboardingStep;
  /** First-run product tour completed/dismissed (per account). */
  tourCompleted: boolean;

  // Free-plan enforcement
  lifetimeClientsCreated: number;

  // Referral
  referralCode: string | null;
}

export interface NotificationPreferences {
  emailInvoicePaid: boolean;
  emailInvoiceViewed: boolean;
  emailInvoiceOverdue: boolean;
  emailClientCreated: boolean;
  emailWeeklyDigest: boolean;
  emailProductUpdates: boolean;
  inAppPayments: boolean;
  inAppClientActivity: boolean;
  inAppContracts: boolean;
  notificationEmail: string;
  quietHours: "none" | "nights" | "weekends" | "both";
  batchNonUrgent: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailInvoicePaid: true,
  emailInvoiceViewed: true,
  emailInvoiceOverdue: true,
  emailClientCreated: false,
  emailWeeklyDigest: true,
  emailProductUpdates: false,
  inAppPayments: true,
  inAppClientActivity: true,
  inAppContracts: true,
  notificationEmail: "",
  quietHours: "none",
  batchNonUrgent: true,
};

function mapNotificationPreferences(
  raw: Record<string, unknown> | null | undefined,
  fallbackEmail: string,
): NotificationPreferences {
  const source = raw ?? {};
  const pickBoolean = (
    key: keyof NotificationPreferences,
    fallback: boolean,
  ) => (typeof source[key] === "boolean" ? source[key] as boolean : fallback);
  const quietHours =
    source.quietHours === "nights" ||
    source.quietHours === "weekends" ||
    source.quietHours === "both"
      ? source.quietHours
      : "none";

  return {
    emailInvoicePaid: pickBoolean("emailInvoicePaid", true),
    emailInvoiceViewed: pickBoolean("emailInvoiceViewed", true),
    emailInvoiceOverdue: pickBoolean("emailInvoiceOverdue", true),
    emailClientCreated: pickBoolean("emailClientCreated", false),
    emailWeeklyDigest: pickBoolean("emailWeeklyDigest", true),
    emailProductUpdates: pickBoolean("emailProductUpdates", false),
    inAppPayments: pickBoolean("inAppPayments", true),
    inAppClientActivity: pickBoolean("inAppClientActivity", true),
    inAppContracts: pickBoolean("inAppContracts", true),
    notificationEmail:
      typeof source.notificationEmail === "string" && source.notificationEmail
        ? source.notificationEmail
        : fallbackEmail,
    quietHours,
    batchNonUrgent: pickBoolean("batchNonUrgent", true),
  };
}

export function mapProfileRow(row: UserProfileRow): BusinessProfile {
  return {
    userId: row.id,
    email: row.email,
    fullName: row.full_name,
    displayName: row.display_name,
    phone: row.phone,
    role: row.role,
    bio: row.bio,
    avatarPath: row.avatar_url,
    avatarUrl: null,
    legalName: row.legal_name,
    businessName: row.business_name,
    businessType: row.business_type,
    businessEmail: row.business_email,
    businessPhone: row.business_phone,
    website: row.website,
    logoPath: row.logo_url,
    logoUrl: null,
    brandIconPath: row.brand_icon_url,
    brandIconUrl: null,
    brandColor: row.brand_color,
    brandTagline: row.brand_tagline,
    brandSignature: row.brand_signature,
    brandIntro: row.brand_intro,
    signatureType: row.signature_type,
    signatureImageUrl: row.signature_image_url,
    signatureTextValue: row.signature_text_value,
    signatureFontFamily: row.signature_font_family,
    signatureUpdatedAt: row.signature_updated_at,
    gstRegistered: row.gst_registered,
    gstin: row.gstin,
    pan: row.pan,
    stateCode: row.state_code,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    defaultCurrency: row.default_currency,
    timezone: row.timezone,
    invoicePrefix: row.invoice_prefix,
    invoiceNextNumber: row.invoice_next_number,
    invoiceNumberPadding: row.invoice_number_padding,
    invoiceResetYearly: row.invoice_reset_yearly,
    invoiceDefaultTaxMode: row.invoice_default_tax_mode,
    invoiceDefaultGstRate: row.invoice_default_gst_rate,
    invoiceDefaultHsnSac: row.invoice_default_hsn_sac ?? null,
    invoiceSendReminders: row.invoice_send_reminders,
    invoiceDefaultDueDays: row.invoice_default_due_days,
    invoiceDefaultNotes: row.invoice_default_notes,
    invoiceDefaultTerms: row.invoice_default_terms,
    notificationPreferences: mapNotificationPreferences(
      row.notification_preferences,
      row.business_email ?? row.email,
    ),
    onboardingCompleted: row.onboarding_completed,
    onboardingCompletedAt: row.onboarding_completed_at,
    onboardingStep: row.onboarding_step,
    tourCompleted:
      (row as { onboarding_tour_done?: boolean | null }).onboarding_tour_done ?? false,
    lifetimeClientsCreated: row.lifetime_clients_created,
    referralCode: row.referral_code ?? null,
  };
}

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string }[] = [
  { value: "individual",       label: "Individual / Freelancer" },
  { value: "sole_proprietor",  label: "Sole proprietor" },
  { value: "partnership",      label: "Partnership" },
  { value: "llp",              label: "LLP" },
  { value: "private_limited",  label: "Private limited" },
  { value: "other",            label: "Other" },
];
