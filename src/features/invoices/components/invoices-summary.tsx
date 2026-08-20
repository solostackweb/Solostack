import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { InvoiceRecord } from "../server";

interface SummaryStats {
  paidThisMonthAmount: number;
  paidThisMonthCount: number;
  paidAllTimeAmount: number;
  paidAllTimeCount: number;
  emailedCount: number;
  averageInvoiceAmount: number;
}

/**
 * Derive the four KPI tiles from a snapshot of invoices. Pure and
 * deterministic — safe to memoize at the call site.
 */
export function computeInvoiceStats(invoices: InvoiceRecord[]): SummaryStats {
  const now = new Date();
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  let paidThisMonthAmount = 0;
  let paidThisMonthCount = 0;
  let paidAllTimeAmount = 0;
  let paidAllTimeCount = 0;
  let emailedCount = 0;

  // Consolidate every invoice to INR so a foreign-currency invoice (e.g. a
  // $140 export invoice) is never counted as ₹140. Prefer the locked
  // inr_equivalent; otherwise convert via the stored FX rate; otherwise assume
  // the amount is already INR.
  const toInr = (inv: InvoiceRecord): number => {
    if (inv.inrEquivalent != null) return Number(inv.inrEquivalent) || 0;
    const rate = Number(inv.fxRateToInr) || 1;
    return (Number(inv.totalAmount) || 0) * rate;
  };

  for (const inv of invoices) {
    const total = toInr(inv);
    if (inv.status === "paid") {
      paidAllTimeAmount += total;
      paidAllTimeCount += 1;
      if (inv.paidAt && new Date(inv.paidAt) >= startOfMonth) {
        paidThisMonthAmount += total;
        paidThisMonthCount += 1;
      }
    }
    if (inv.sentAt) emailedCount += 1;
  }

  return {
    paidThisMonthAmount,
    paidThisMonthCount,
    paidAllTimeAmount,
    paidAllTimeCount,
    emailedCount,
    averageInvoiceAmount:
      paidAllTimeCount > 0 ? paidAllTimeAmount / paidAllTimeCount : 0,
  };
}

export function InvoicesSummary({
  invoices,
}: {
  invoices: InvoiceRecord[];
}) {
  const stats = React.useMemo(() => computeInvoiceStats(invoices), [invoices]);

  return (
    <Card>
      <CardContent className="grid grid-cols-2 divide-x-0 divide-y p-0 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <SummaryCell
          label="Paid this month"
          value={formatINR(stats.paidThisMonthAmount)}
          helper={`${stats.paidThisMonthCount} collected`}
          tone="success"
        />
        <SummaryCell
          label="Paid invoices"
          value={formatINR(stats.paidAllTimeAmount)}
          helper={`${stats.paidAllTimeCount} invoice${stats.paidAllTimeCount === 1 ? "" : "s"} issued`}
        />
        <SummaryCell
          label="Emailed"
          value={String(stats.emailedCount)}
          helper="PDFs sent to clients"
        />
        <SummaryCell
          label="Average invoice"
          value={formatINR(stats.averageInvoiceAmount)}
          helper="Across paid invoices"
        />
      </CardContent>
    </Card>
  );
}

interface SummaryCellProps {
  label: string;
  value: string;
  helper: string;
  tone?: "default" | "success";
}

function SummaryCell({
  label,
  value,
  helper,
  tone = "default",
}: SummaryCellProps) {
  return (
      <div className="min-h-24 min-w-0 space-y-1 p-4 sm:p-5">
          <p className="break-words text-micro font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", tone === "success" && "text-success-strong")}>
            {value}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">{helper}</p>
      </div>
  );
}
