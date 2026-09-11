import { z } from "zod";
import { isValidGstin, isValidPan } from "@/features/gst/validation";
import { isValidStateCode } from "@/features/gst/state-codes";
import { GST_RATES } from "@/features/invoices/schema";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined));

const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

const stateCodeSchema = z
  .string()
  .trim()
  .refine(isValidStateCode, "Pick a valid Indian state");

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidGstin, "Enter a valid 15-character GSTIN");

const panSchema = optionalText(10).pipe(
  z
    .string()
    .optional()
    .refine((v) => !v || isValidPan(v), "Enter a valid 10-character PAN"),
);

const hexColorSchema = optionalText(7).pipe(
  z
    .string()
    .optional()
    .refine(
      (v) => !v || /^#[0-9A-Fa-f]{6}$/.test(v),
      "Enter a valid hex color",
    ),
);

export const personalProfileSchema = z.object({
  fullName: requiredText("Full name", 120),
  displayName: optionalText(120),
  email: z.string().trim().email("Enter a valid email"),
  phone: optionalText(20),
  role: optionalText(80),
  bio: optionalText(500),
});

export type PersonalProfileInput = z.infer<typeof personalProfileSchema>;

export const localizationSchema = z.object({
  defaultCurrency: z.string().trim().min(3).max(3),
  timezone: z.string().trim().min(1).max(64),
});

export type LocalizationInput = z.infer<typeof localizationSchema>;

export const businessDetailsSchema = z.object({
  businessName: optionalText(120),
  legalName: optionalText(120),
  businessType: z.enum([
    "individual",
    "sole_proprietor",
    "partnership",
    "llp",
    "private_limited",
    "other",
  ]),
  businessEmail: optionalText(120).pipe(
    z.string().email("Enter a valid email").optional().or(z.literal("")),
  ),
  businessPhone: optionalText(20),
  website: optionalText(200),
});

export type BusinessDetailsInput = z.infer<typeof businessDetailsSchema>;

export const taxInfoSchema = z.discriminatedUnion("gstRegistered", [
  z.object({
    gstRegistered: z.literal(false),
    gstin: z.literal("").optional(),
    pan: panSchema,
    stateCode: stateCodeSchema.optional(),
    country: z.string().trim().min(2).max(2).default("IN"),
  }),
  z.object({
    gstRegistered: z.literal(true),
    gstin: gstinSchema,
    pan: panSchema,
    stateCode: stateCodeSchema,
    country: z.string().trim().min(2).max(2).default("IN"),
  }),
]);

export type TaxInfoInput = z.infer<typeof taxInfoSchema>;

export const addressSchema = z.object({
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  stateCode: stateCodeSchema.optional(),
  postalCode: optionalText(20),
  country: z.string().trim().min(2).max(2).default("IN"),
});

export type AddressInput = z.infer<typeof addressSchema>;

export const brandingSchema = z.object({
  brandColor: hexColorSchema,
  brandTagline: optionalText(120),
  brandSignature: optionalText(120),
  brandIntro: optionalText(600),
});

export type BrandingInput = z.infer<typeof brandingSchema>;

export const signatureSchema = z.object({
  signatureType: z.enum(["draw", "type", "upload"]),
  signatureImageUrl: optionalText(200000),
  signatureTextValue: optionalText(120),
  signatureFontFamily: optionalText(80),
});

export type SignatureInput = z.infer<typeof signatureSchema>;

export const invoiceDefaultsSchema = z.object({
  invoicePrefix: z.string().trim().max(10).default("INV-"),
  invoiceNextNumber: z.coerce.number().int().min(1),
  invoiceNumberPadding: z.coerce.number().int().min(3).max(6).default(4),
  invoiceResetYearly: z.coerce.boolean().default(false),
  invoiceDefaultTaxMode: z.enum(["intra", "inter"]).default("intra"),
  invoiceDefaultGstRate: z
    .coerce
    .number()
    .refine((v) => (GST_RATES as readonly number[]).includes(v), {
      message: "Select a valid GST rate",
    })
    .default(18),
  invoiceDefaultHsnSac: optionalText(20),
  invoiceDefaultDueDays: z.coerce.number().int().min(0).max(365).default(14),
  invoiceDefaultNotes: optionalText(500),
  invoiceDefaultTerms: optionalText(2000),
  defaultCurrency: z.string().trim().min(3).max(3),
  invoiceSendReminders: z.coerce.boolean().default(true),
});

export type InvoiceDefaultsInput = z.infer<typeof invoiceDefaultsSchema>;

export const notificationPreferencesSchema = z.object({
  emailInvoicePaid: z.coerce.boolean().default(true),
  emailInvoiceViewed: z.coerce.boolean().default(true),
  emailInvoiceOverdue: z.coerce.boolean().default(true),
  emailClientCreated: z.coerce.boolean().default(false),
  emailWeeklyDigest: z.coerce.boolean().default(true),
  emailProductUpdates: z.coerce.boolean().default(false),
  inAppPayments: z.coerce.boolean().default(true),
  inAppClientActivity: z.coerce.boolean().default(true),
  inAppContracts: z.coerce.boolean().default(true),
  notificationEmail: z.string().trim().email("Enter a valid notification email"),
  quietHours: z.enum(["none", "nights", "weekends", "both"]).default("none"),
  batchNonUrgent: z.coerce.boolean().default(true),
});

export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;

// ============================================================================
// Public Profile Schemas
// ============================================================================

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(50, "Slug must be at most 50 characters")
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, "Slug can only contain lowercase letters, numbers, and hyphens (no leading/trailing hyphens)");

export const publicProfileSchema = z.object({
  publicSlug: slugSchema.optional(),
  publicProfileEnabled: z.coerce.boolean().default(false),
  publicBio: z.string().trim().max(1000).optional().or(z.literal("")).transform((v) => v || null),
  publicServices: z.array(z.string().trim().max(60)).max(20).optional().default([]),
  publicIndustries: z.array(z.string().trim().max(60)).max(20).optional().default([]),
  publicLocation: z.string().trim().max(120).optional().or(z.literal("")).transform((v) => v || null),
  publicLanguages: z.array(z.string().trim().max(40)).max(10).optional().default([]),
  publicAvailability: z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || null),
  publicStartingRate: z.coerce.number().min(0).max(10000000).optional().nullable(),
  publicStartingRateCurrency: z.string().trim().min(3).max(3).default("INR"),
  publicShowReviews: z.coerce.boolean().default(true),
  publicShowPortfolio: z.coerce.boolean().default(true),
  publicShowStats: z.coerce.boolean().default(true),
  publicCtaText: z.string().trim().max(60).default("Start a project"),
  publicCtaAction: z.enum(["enquiry", "calendly", "custom_url"]).default("enquiry"),
  publicCustomDomain: z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || null),
  publicSeoTitle: z.string().trim().max(60).optional().or(z.literal("")).transform((v) => v || null),
  publicSeoDescription: z.string().trim().max(160).optional().or(z.literal("")).transform((v) => v || null),
  publicOgImage: z.string().trim().max(500).optional().or(z.literal("")).transform((v) => v || null),
});

export type PublicProfileInput = z.infer<typeof publicProfileSchema>;

export const portfolioItemSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")).transform((v) => v || null),
  coverImageUrl: z.string().trim().max(2000).optional().or(z.literal("")).transform((v) => v || null),
  images: z.array(z.string().trim().max(2000)).max(20).optional().default([]),
  category: z.string().trim().max(80).optional().or(z.literal("")).transform((v) => v || null),
  industry: z.string().trim().max(80).optional().or(z.literal("")).transform((v) => v || null),
  budgetRange: z.string().trim().max(60).optional().or(z.literal("")).transform((v) => v || null),
  duration: z.string().trim().max(60).optional().or(z.literal("")).transform((v) => v || null),
  technologies: z.array(z.string().trim().max(40)).max(30).optional().default([]),
  clientName: z.string().trim().max(120).optional().or(z.literal("")).transform((v) => v || null),
  clientIndustry: z.string().trim().max(80).optional().or(z.literal("")).transform((v) => v || null),
  testimonial: z.string().trim().max(2000).optional().or(z.literal("")).transform((v) => v || null),
  featured: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});

export type PortfolioItemInput = z.infer<typeof portfolioItemSchema>;
