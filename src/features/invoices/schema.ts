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
  })
  .refine(
    (data) => {
      if (!data.issueDate || !data.dueDate) return true;
      return new Date(data.dueDate) >= new Date(data.issueDate);
    },
    { message: "Due date must be on or after issue date", path: ["dueDate"] },
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
