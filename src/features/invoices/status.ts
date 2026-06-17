/**
 * Canonical labels + ordering for the DB `invoice_status` enum. Kept in a
 * dependency-free module so both server and client components can import.
 */

import type { InvoiceStatusRow } from "@/lib/supabase/types";

export const INVOICE_STATUSES: InvoiceStatusRow[] = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "partially_paid",
  "cancelled",
];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatusRow, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  overdue: "Overdue",
  partially_paid: "Partially paid",
  cancelled: "Cancelled",
};

/**
 * Client-facing status label. Never surfaces internal states (draft/sent/
 * viewed) to a recipient — those all read as "Due". Used by the public
 * invoice page and the client portal so both stay consistent.
 */
export function clientFacingInvoiceStatus(status: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "partially_paid":
      return "Partially paid";
    case "cancelled":
      return "Cancelled";
    default:
      return "Due";
  }
}
