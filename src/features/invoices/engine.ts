/**
 * Pure invoice calculation engine.
 *
 * No I/O, no Supabase, no Zod — just typed math. Used by:
 *   * Server actions (to compute totals before persisting).
 *   * Client previews (to render live totals while editing).
 *   * PDF generation (later).
 *
 * Tax behaviour anchored to:
 *   Stackivo GST compliance matrix — §6 / §7
 *
 * Money is handled as `number` of currency units (e.g. INR rupees) at two
 * decimal precision. We round each component HALF-UP after computing it,
 * to avoid the floating-point drift that bites every spreadsheet-derived
 * invoice in the universe.
 */

import { decideTax } from "@/features/gst/decision";
import type { TaxDecision, TaxMode } from "@/features/gst/decision";

export interface InvoiceLineInput {
  /** Free-text description of the line item. */
  description: string;
  /** Units / hours / fixed (defaults to 1 when omitted upstream). */
  quantity: number;
  /** Per-unit price in currency units (e.g. rupees). */
  unitPrice: number;
  /**
   * Total GST rate for this line (e.g. 18 for 18%). The engine splits this
   * 50/50 into CGST + SGST for intra-state, or applies it whole as IGST for
   * inter-state. Unused on `non_gst` mode.
   */
  gstRate: number;
}

export interface InvoiceLineResult extends InvoiceLineInput {
  /** Pre-tax line subtotal: `quantity * unitPrice` (rounded). */
  amount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Total tax for the line (cgst + sgst + igst). */
  taxAmount: number;
  /** Line total including tax. */
  totalAmount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  /** Sum of cgst + sgst + igst. Equivalent to the legacy `gst_amount` column. */
  taxTotal: number;
  total: number;
  taxMode: TaxMode;
  decision: TaxDecision;
  lines: InvoiceLineResult[];
}

export interface CalculateInvoiceInput {
  lines: InvoiceLineInput[];
  discount?: number;
  seller: { gstRegistered: boolean; stateCode: string | null };
  client: { gstRegistered: boolean; stateCode: string | null };
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute the per-line + invoice-level totals for a set of inputs.
 *
 * Pure: same input → same output. Safe to call from anywhere.
 */
export function calculateInvoice(input: CalculateInvoiceInput): InvoiceTotals {
  const decision = decideTax({ seller: input.seller, client: input.client });

  const lines: InvoiceLineResult[] = input.lines.map((line) => {
    const qty = Number.isFinite(line.quantity) ? line.quantity : 0;
    const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
    const rate = Number.isFinite(line.gstRate) ? line.gstRate : 0;

    const amount = round2(qty * price);

    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (decision.mode === "cgst_sgst") {
      const half = (amount * rate) / 200;
      cgst = round2(half);
      sgst = round2(half);
    } else if (decision.mode === "igst") {
      igst = round2((amount * rate) / 100);
    }

    const taxAmount = round2(cgst + sgst + igst);
    return {
      ...line,
      quantity: qty,
      unitPrice: price,
      gstRate: rate,
      amount,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      taxAmount,
      totalAmount: round2(amount + taxAmount),
    };
  });

  const subtotal = round2(lines.reduce((acc, l) => acc + l.amount, 0));
  const discount = Math.min(subtotal, round2(Math.max(0, input.discount ?? 0)));
  const taxableRatio = subtotal > 0 ? (subtotal - discount) / subtotal : 0;
  const cgstAmount = round2(lines.reduce((acc, l) => acc + l.cgstAmount, 0) * taxableRatio);
  const sgstAmount = round2(lines.reduce((acc, l) => acc + l.sgstAmount, 0) * taxableRatio);
  const igstAmount = round2(lines.reduce((acc, l) => acc + l.igstAmount, 0) * taxableRatio);
  const taxTotal = round2(cgstAmount + sgstAmount + igstAmount);
  const total = round2(subtotal - discount + taxTotal);

  return {
    subtotal,
    discount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxTotal,
    total,
    taxMode: decision.mode,
    decision,
    lines,
  };
}

/**
 * Format an integer + prefix into a stable invoice number.
 *   formatInvoiceNumber("INV-", 7)              → "INV-0007"
 *   formatInvoiceNumber("INV-", 7, 6)           → "INV-000007"
 */
export function formatInvoiceNumber(
  prefix: string,
  n: number,
  pad = 4,
): string {
  const cleanPrefix = prefix ?? "";
  const padded = String(Math.max(1, Math.floor(n))).padStart(pad, "0");
  return `${cleanPrefix}${padded}`;
}
