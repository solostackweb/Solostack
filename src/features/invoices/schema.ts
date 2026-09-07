import { z } from "zod";

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export type GstRate = (typeof GST_RATES)[number];

export const PAYMENT_METHODS = ["bank", "upi", "card", "cash"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank: "Bank transfer",
  upi: "UPI",
  card: "Card",
  cash: "Cash",
};

// Recurring invoice constants (must be before invoiceFormSchema)
export const RECURRING_FREQUENCIES = ["weekly", "monthly", "quarterly", "yearly"] as const;
export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export const RECURRING_STATUS = ["draft", "sent"] as const;
export type RecurringStatus = (typeof RECURRING_STATUS)[number];

/** A single line item on the invoice. `amount` is derived (qty × rate). */
export const invoiceItemSchema = z.object({
  id: z.string(),
  description: z
    .string()
    .min(1, "Description is required")
    .max(200, "Description is too long"),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantity must be a number" })
    .positive("Quantity must be greater than zero")
    .max(100000, "Quantity seems too high"),
  rate: z.coerce
    .number({ invalid_type_error: "Rate must be a number" })
    .nonnegative("Rate must be zero or more"),
});

export type InvoiceItemValues = z.infer<typeof invoiceItemSchema>;

/**
 * Full "Create invoice" form schema.
 *
 * Dates use ISO `YYYY-MM-DD` strings to map directly onto native date inputs.
 * Derived values (amount-per-row, subtotal, tax, total) are computed on the
 * fly from these fields — not stored in form state.
 */
export const invoiceFormSchema = z
  .object({
    invoiceNumber: z
      .string()
      .min(1, "Invoice number is required")
      .max(40, "Invoice number is too long"),
    clientId: z.string().min(1, "Choose a client"),
    projectId: z.string().optional().or(z.literal("")),
    issueDate: z.string().min(1, "Issue date is required"),
    dueDate: z.string().min(1, "Due date is required"),
    items: z
      .array(invoiceItemSchema)
      .min(1, "Add at least one line item"),
    taxMode: z.enum(["intra", "inter"]),
    gstRate: z.coerce.number().refine(
      (v) => (GST_RATES as readonly number[]).includes(v),
      { message: "Select a valid GST rate" },
    ),
    discount: z.coerce
      .number()
      .nonnegative("Discount cannot be negative")
      .default(0),
    paymentMethod: z.enum(PAYMENT_METHODS),
    hsnSac: z.string().max(20, "HSN/SAC is too long").optional().or(z.literal("")),
    notes: z.string().max(1000, "Notes are too long").optional().or(z.literal("")),
    terms: z.string().max(1000, "Terms are too long").optional().or(z.literal("")),
    // Recurring invoice fields (optional)
    isRecurring: z.boolean().default(false),
    frequency: z.enum(RECURRING_FREQUENCIES).optional(),
    interval: z.coerce.number().int().positive().default(1).optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    maxOccurrences: z.coerce.number().int().positive().optional().nullable(),
    statusOnCreate: z.enum(RECURRING_STATUS).optional(),
    issueDateOffset: z.coerce.number().int().min(0).default(0).optional(),
    dueDateOffset: z.coerce.number().int().min(0).default(14).optional(),
  })
  .refine(
    (data) => {
      if (!data.issueDate || !data.dueDate) return true;
      return new Date(data.dueDate) >= new Date(data.issueDate);
    },
    { message: "Due date must be on or after issue date", path: ["dueDate"] },
  )
  .refine(
    (data) => {
      if (!data.isRecurring) return true;
      if (data.frequency === "weekly" && data.dayOfWeek === null) return false;
      if (["monthly", "quarterly", "yearly"].includes(data.frequency || "") && data.dayOfMonth === null) return false;
      if (!data.startDate) return false;
      return true;
    },
    { message: "Recurring requires frequency, day, and start date", path: ["frequency"] }
  );

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

// -------------------------------------------------------------------------
// Derived calculations — kept here so the preview, totals card, and submit
// handler all use the exact same math.
// -------------------------------------------------------------------------

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  total: number;
}

export function computeItemAmount(item: Pick<InvoiceItemValues, "quantity" | "rate">) {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  return Math.round(qty * rate * 100) / 100;
}

export function computeInvoiceTotals(
  values: Pick<InvoiceFormValues, "items" | "taxMode" | "gstRate" | "discount">,
): InvoiceTotals {
  const subtotal = (values.items ?? []).reduce(
    (sum, item) => sum + computeItemAmount(item),
    0,
  );
  const discount = Math.max(0, Number(values.discount) || 0);
  const taxableAmount = Math.max(0, subtotal - discount);
  const rate = (Number(values.gstRate) || 0) / 100;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (values.taxMode === "intra") {
    const half = (taxableAmount * rate) / 2;
    cgst = Math.round(half * 100) / 100;
    sgst = Math.round(half * 100) / 100;
  } else {
    igst = Math.round(taxableAmount * rate * 100) / 100;
  }

  const taxTotal = Math.round((cgst + sgst + igst) * 100) / 100;
  const total = Math.round((taxableAmount + taxTotal) * 100) / 100;

  return {
    subtotal,
    discount,
    taxableAmount,
    cgst,
    sgst,
    igst,
    taxTotal,
    total,
  };
}

// -------------------------------------------------------------------------
// Recurring Invoice Schema
// -------------------------------------------------------------------------

export const recurringInvoiceItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1).max(200),
  quantity: z.coerce.number().positive().max(100000),
  rate: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().nonnegative().default(0),
});

export type RecurringInvoiceItemValues = z.infer<typeof recurringInvoiceItemSchema>;

export const recurringInvoiceFormSchema = z
  .object({
    clientId: z.string().min(1, "Choose a client"),
    projectId: z.string().optional().or(z.literal("")),
    frequency: z.enum(RECURRING_FREQUENCIES),
    interval: z.coerce.number().int().positive().default(1),
    dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().optional().or(z.literal("")).nullable(),
    maxOccurrences: z.coerce.number().int().positive().optional().nullable(),
    currency: z.string().default("INR"),
    issueDateOffset: z.coerce.number().int().min(0).default(0),
    dueDateOffset: z.coerce.number().int().min(0).default(14),
    statusOnCreate: z.enum(RECURRING_STATUS).default("draft"),
    discount: z.coerce.number().nonnegative().default(0),
    notes: z.string().max(1000).optional().or(z.literal("")),
    terms: z.string().max(1000).optional().or(z.literal("")),
    hsnSac: z.string().max(20).optional().or(z.literal("")),
    gstRate: z.coerce.number().nonnegative().default(0),
    items: z.array(recurringInvoiceItemSchema).min(1, "Add at least one line item"),
    invoicePrefix: z.string().max(20).optional().or(z.literal("")),
    invoiceNumberPadding: z.coerce.number().int().min(1).max(10).optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.frequency === "weekly" && data.dayOfWeek === null) return false;
      if (["monthly", "quarterly", "yearly"].includes(data.frequency) && data.dayOfMonth === null) return false;
      return true;
    },
    { message: "Day of week is required for weekly frequency", path: ["dayOfWeek"] }
  )
  .refine(
    (data) => {
      if (data.frequency !== "weekly" && data.dayOfWeek !== null) return false;
      return true;
    },
    { message: "Day of week only applies to weekly frequency", path: ["dayOfWeek"] }
  );

export type RecurringInvoiceFormValues = z.infer<typeof recurringInvoiceFormSchema>;

export interface RecurringInvoiceRecord {
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
  status_on_create: RecurringStatus;
  discount: number;
  notes: string | null;
  terms: string | null;
  hsn_sac: string | null;
  gst_rate: number;
  items: RecurringInvoiceItemValues[];
  last_generated_at: string | null;
  next_generation_at: string | null;
  generation_count: number;
  is_active: boolean;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}