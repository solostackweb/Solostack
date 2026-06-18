import "server-only";

/**
 * Business-facts snapshot for the AI assistant's data-aware Q&A.
 *
 * Assembles a compact, RLS-scoped picture of the user's own numbers by reusing
 * the Pulse + Time analytics engines. The assistant answers questions GROUNDED
 * in this snapshot — it never invents figures. Only the requesting user's data
 * is ever included.
 */

import { getPulseAnalytics } from "@/features/pulse/analytics";
import { getPulseInsights } from "@/features/pulse/insights";
import { getUnbilledTime } from "@/features/time/server";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const hrs = (seconds: number) => Math.round(((seconds || 0) / 3600) * 10) / 10;

export interface BusinessFacts {
  today: string;
  currency: "INR";
  revenue: {
    last12mPaid: number;
    thisMonthPaid: number;
    averageMonthly: number;
    momGrowthPct: number | null;
    collectionRatePct: number | null;
    monthlySeries: Array<{ month: string; paid: number }>;
  };
  invoices: {
    issuedLast12m: number;
    paidLast12m: number;
    outstandingTotal: number;
    outstandingCount: number;
    overdueTotal: number;
    overdueCount: number;
    avgDaysToPay: number | null;
    aging: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number };
    funnel: { issued: number; viewed: number; paid: number };
  };
  clients: {
    newLast12m: number;
    returningLast12m: number;
    topByRevenue: Array<{ name: string; paid: number; sharePct: number }>;
    revenueConcentrationTop1Pct: number | null;
    revenueConcentrationTop3Pct: number | null;
  };
  projects: {
    revenueByProject: Array<{ name: string; paid: number }>;
  };
  time: {
    trackedHoursLast12m: number;
    billableHoursLast12m: number;
    invoicedValue: number;
    unbilledValue: number;
    effectiveHourlyRate: number;
  };
  unbilled: {
    totalValue: number;
    totalHours: number;
    byProject: Array<{ project: string; hours: number; value: number }>;
  };
  gst: {
    inUse: boolean;
    registered: boolean;
    taxableValue: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  };
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build the snapshot. Four engine calls (12-month analytics + insights,
 * current-month analytics, unbilled time) — fine for an on-demand question.
 */
export async function getBusinessFacts(): Promise<BusinessFacts> {
  const now = new Date();
  const to = isoDay(now);
  const from12 = isoDay(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1)),
  );
  const fromMonth = isoDay(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  );

  const [a12, ins12, aMonth, unbilled] = await Promise.all([
    getPulseAnalytics({ from: from12, to }),
    getPulseInsights({ from: from12, to }),
    getPulseAnalytics({ from: fromMonth, to }),
    getUnbilledTime(),
  ]);

  return {
    today: to,
    currency: "INR",
    revenue: {
      last12mPaid: r2(a12.revenue.paid),
      thisMonthPaid: r2(aMonth.revenue.paid),
      averageMonthly: r2(a12.revenue.averageMonthly),
      momGrowthPct: a12.revenue.momGrowthPct,
      collectionRatePct: a12.invoices.collectionRatePct,
      monthlySeries: a12.revenue.series.map((s) => ({ month: s.month, paid: r2(s.paid) })),
    },
    invoices: {
      issuedLast12m: a12.invoices.issuedCount,
      paidLast12m: a12.invoices.paidCount,
      outstandingTotal: r2(a12.receivables.outstandingTotal),
      outstandingCount: a12.receivables.outstandingCount,
      overdueTotal: r2(a12.receivables.overdueTotal),
      overdueCount: a12.receivables.overdueCount,
      avgDaysToPay: a12.cashFlow.avgDaysToPay,
      aging: {
        current: r2(a12.receivables.aging.current),
        d1_30: r2(a12.receivables.aging.d1_30),
        d31_60: r2(a12.receivables.aging.d31_60),
        d61_90: r2(a12.receivables.aging.d61_90),
        d90plus: r2(a12.receivables.aging.d90plus),
      },
      funnel: {
        issued: a12.funnel.issued,
        viewed: a12.funnel.viewed,
        paid: a12.funnel.paid,
      },
    },
    clients: {
      newLast12m: ins12.clients.newCount,
      returningLast12m: ins12.clients.returningCount,
      topByRevenue: ins12.concentration.byClient
        .slice(0, 8)
        .map((c) => ({ name: c.name, paid: r2(c.paid), sharePct: r2(c.pct) })),
      revenueConcentrationTop1Pct: ins12.concentration.top1Pct,
      revenueConcentrationTop3Pct: ins12.concentration.top3Pct,
    },
    projects: {
      revenueByProject: ins12.byProject
        .slice(0, 8)
        .map((p) => ({ name: p.name, paid: r2(p.paid) })),
    },
    time: {
      trackedHoursLast12m: hrs(ins12.profitability.trackedSeconds),
      billableHoursLast12m: hrs(ins12.profitability.billableSeconds),
      invoicedValue: r2(ins12.profitability.invoicedAmount),
      unbilledValue: r2(ins12.profitability.unbilledAmount),
      effectiveHourlyRate: r2(ins12.profitability.effectiveRate),
    },
    unbilled: {
      totalValue: r2(unbilled.totalAmount),
      totalHours: hrs(unbilled.totalSeconds),
      byProject: unbilled.groups.slice(0, 8).map((g) => ({
        project: g.projectName ?? "No project",
        hours: hrs(g.seconds),
        value: r2(g.amount),
      })),
    },
    gst: {
      inUse: a12.gst.inUse,
      registered: a12.gst.registered,
      taxableValue: r2(a12.gst.totals.taxable),
      cgst: r2(a12.gst.totals.cgst),
      sgst: r2(a12.gst.totals.sgst),
      igst: r2(a12.gst.totals.igst),
      totalTax: r2(a12.gst.totals.tax),
    },
  };
}
