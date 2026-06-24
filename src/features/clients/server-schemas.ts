/**
 * Zod schemas for the persistent client CRUD surface.
 *
 * Kept separate from older UI form schemas so the
 * GST-aware shape can evolve independently. Onboarding's "first client"
 * step has its own schema in `@/features/onboarding/schemas`.
 */

import { z } from "zod";
import { isValidGstin } from "@/features/gst/validation";
import { isValidStateCode } from "@/features/gst/state-codes";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const stateCodeSchema = z
  .string()
  .trim()
  .refine(isValidStateCode, "Pick a valid Indian state");

const gstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isValidGstin, "Enter a valid 15-character GSTIN");

// ISO-2 country code; defaults to IN. Currency ISO-4217; defaults to INR.
const countrySchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const c = (v ?? "").toUpperCase();
    return c.length === 2 ? c : "IN";
  });
const currencySchema = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    const c = (v ?? "").toUpperCase();
    return c.length >= 3 ? c.slice(0, 3) : "INR";
  });

/**
 * Discriminated by `gstRegistered` so the resolver can require GSTIN +
 * billing address only on the GST branch.
 */
export const clientCrudSchema = z.discriminatedUnion("gstRegistered", [
  z.object({
    gstRegistered: z.literal(false),
    fullName: z
      .string()
      .trim()
      .min(1, "Client name is required")
      .max(120, "Name is too long"),
    businessName: optionalText(120),
    email: optionalEmail,
    phone: optionalText(20),
    country: countrySchema,
    currency: currencySchema,
    locale: optionalText(20),
    // Loose here: Indian non-GST clients still need a valid state (enforced in
    // the action); foreign clients have no Indian state.
    stateCode: optionalText(2),
    billingAddress: optionalText(300),
    notes: optionalText(500),
    gstin: z.literal("").optional(),
  }),
  z.object({
    gstRegistered: z.literal(true),
    fullName: z
      .string()
      .trim()
      .min(1, "Client name is required")
      .max(120, "Name is too long"),
    businessName: optionalText(120),
    email: optionalEmail,
    phone: optionalText(20),
    country: countrySchema,
    currency: currencySchema,
    locale: optionalText(20),
    stateCode: stateCodeSchema,
    billingAddress: z
      .string()
      .trim()
      .min(1, "Billing address is required for GST clients")
      .max(300, "Address is too long"),
    notes: optionalText(500),
    gstin: gstinSchema,
  }),
]);

export type ClientCrudInput = z.infer<typeof clientCrudSchema>;

export const clientIdSchema = z.string().uuid("Invalid client id");
