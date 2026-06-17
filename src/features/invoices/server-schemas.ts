/**
 * Server-side Zod schemas for invoice persistence.
 *
 * The line-item shape matches what the calculation engine
 * (`./engine.ts::InvoiceLineInput`) expects, plus an optional `position`
 * for drag-reordering in the UI.
 */

import { z } from "zod";

const optionalUuid = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => !v || /^[0-9a-fA-F-]{36}$/.test(v), "Invalid id");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : undefined));

const isoDate = z.string().refine(
  (v) => !Number.isNaN(Date.parse(v)),
  "Invalid date",
);

export const invoiceLineSchema = z.object({
  id: z.string().uuid().optional(),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(500, "Description is too long"),
  quantity: z.coerce.number().min(0, "Quantity must be ≥ 0"),
  unitPrice: z.coerce.number().min(0, "Price must be ≥ 0"),
  gstRate: z.coerce
    .number()
    .min(0, "GST rate must be ≥ 0")
    .max(50, "GST rate looks too high"),
  position: z.coerce.number().int().min(0).default(0),
});

export type InvoiceLineSchemaInput = z.infer<typeof invoiceLineSchema>;

export const invoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "partially_paid",
  "cancelled",
]);

export const invoiceCrudSchema = z.object({
  clientId: optionalUuid,
  projectId: optionalUuid,
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Invoice number is required")
    .max(40, "Invoice number is too long"),
  issueDate: isoDate,
  dueDate: isoDate,
  currency: z.string().trim().min(3).max(3).default("INR"),
  status: invoiceStatusSchema.default("draft"),
  discount: z.coerce.number().min(0, "Discount cannot be negative").default(0),
  notes: optionalText(2000),
  terms: optionalText(2000),
  hsnSac: optionalText(20),
  lines: z.array(invoiceLineSchema).min(1, "Add at least one line item"),
  /** Billable time entries this invoice covers — marked invoiced on create. */
  timeEntryIds: z.array(z.string().uuid()).max(500).optional(),
});

export type InvoiceCrudInput = z.infer<typeof invoiceCrudSchema>;

export const invoiceIdSchema = z.string().uuid("Invalid invoice id");
