import * as React from "react";
import {
  CheckCircle2,
  FileText,
  Send,
  TrendingUp,
} from "lucide-react";

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
    <div className="grid gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
      <SummaryCard
        label="Paid this month"
        value={formatINR(stats.paidThisMonthAmount)}
        helper={`${stats.paidThisMonthCount} collected`}
        icon={CheckCircle2}
        tone="success"
        featured
      />
      <SummaryCard
        label="Paid invoices"
        value={formatINR(stats.paidAllTimeAmount)}
        helper={`${stats.paidAllTimeCount} invoice${stats.paidAllTimeCount === 1 ? "" : "s"} issued`}
        icon={FileText}
        tone="default"
      />
      <SummaryCard
        label="Emailed"
        value={String(stats.emailedCount)}
        helper="PDFs sent to clients"
        icon={Send}
        tone="default"
      />
      <SummaryCard
        label="Average invoice"
        value={formatINR(stats.averageInvoiceAmount)}
        helper="Across paid invoices"
        icon={TrendingUp}
        tone="default"
        wideOnMobile
      />
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "default" | "success";
  featured?: boolean;
  wideOnMobile?: boolean;
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  featured,
  wideOnMobile,
}: SummaryCardProps) {
  return (
    <Card className={cn(
      "group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]",
      featured && "col-span-2 lg:col-span-1",
      wideOnMobile && "col-span-2 sm:col-span-1",
    )}>
      <CardContent className="flex min-h-32 items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="break-words text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{helper}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1",
            tone === "success" &&
              "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400",
            tone === "default" &&
              "bg-gradient-to-br from-primary/10 to-blue-500/10 text-primary ring-primary/15",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
