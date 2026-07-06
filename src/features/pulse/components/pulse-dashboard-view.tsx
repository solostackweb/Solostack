"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  CircleDollarSign,
  Clock,
  Download,
  FileText,
  FolderKanban,
  Landmark,
  Timer,
  Minus,
  Percent,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RevenueChart as DashboardRevenueChart } from "@/components/dashboard/revenue-chart";
import type { PulseAnalytics } from "../analytics";
import type { PulseInsights } from "../insights";
import { secondsToHours } from "@/features/time/types";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";

export type PulseRange = "3m" | "6m" | "12m";

export interface PulseTopClient {
  clientId: string | null;
  name: string;
  initials: string;
  totalPaid: number;
  invoiceCount: number;
}

const RANGE_LABEL: Record<PulseRange, string> = {
  "3m": "3 months",
  "6m": "6 months",
  "12m": "12 months",
};

interface PulseDashboardViewProps {
  analytics: PulseAnalytics;
  insights: PulseInsights;
  topClients: PulseTopClient[];
  range: PulseRange;
  custom: { from: string; to: string };
}

export function PulseDashboardView({
  analytics,
  insights,
  topClients,
  range,
  custom,
}: PulseDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCustom = Boolean(custom.from && custom.to);

  const setPreset = (r: PulseRange) => {
    router.replace(`${pathname}?range=${r}`);
  };
  const setCustom = (patch: { from?: string; to?: string }) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("range");
    const from = patch.from ?? custom.from;
    const to = patch.to ?? custom.to;
    if (from) sp.set("from", from);
    else sp.delete("from");
    if (to) sp.set("to", to);
    else sp.delete("to");
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const { revenue, invoices, receivables, cashFlow, funnel } = analytics;
  const rangeLabel = isCustom ? "Selected range" : RANGE_LABEL[range];

  const exportHref = (format: "csv" | "pdf", report?: string) => {
    const sp = new URLSearchParams();
    if (isCustom) {
      sp.set("from", custom.from);
      sp.set("to", custom.to);
    } else {
      sp.set("range", range);
    }
    sp.set("format", format);
    if (report) sp.set("report", report);
    return `/api/pulse/export?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pulse"
        description="Revenue, receivables, collection health, and your top clients — at a glance."
        actions={
          <div className="flex items-center gap-2">
            <IvoEntryPoint
              prompt="Give me a business summary from Pulse and tell me what needs attention."
              label="Ask Ivo"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" /> Export
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Branded PDF</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href={exportHref("pdf")} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" /> Financial report
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>CSV</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a href={exportHref("csv", "summary")}>Financial summary</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={exportHref("csv", "ledger")}>Invoice ledger</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={exportHref("csv", "clients")}>Client revenue</a>
                </DropdownMenuItem>
                {analytics.gst.inUse ? (
                  <DropdownMenuItem asChild>
                    <a href={exportHref("csv", "gst")}>GST report</a>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Range selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5 text-sm">
          {(Object.keys(RANGE_LABEL) as PulseRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setPreset(r)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition",
                !isCustom && range === r
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">From</span>
            <Input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ from: e.target.value })}
              className="h-9 w-[150px]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">To</span>
            <Input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ to: e.target.value })}
              className="h-9 w-[150px]"
            />
          </label>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Kpi
          icon={CircleDollarSign}
          label={`Revenue (${rangeLabel})`}
          value={formatINR(revenue.paid)}
          tone="primary"
          delta={revenue.momGrowthPct}
          helper={`Avg ${formatINR(revenue.averageMonthly)}/mo`}
        />
        <Kpi
          icon={Wallet}
          label="Outstanding"
          value={formatINR(receivables.outstandingTotal)}
          tone={receivables.overdueTotal > 0 ? "warning" : "default"}
          helper={
            receivables.overdueTotal > 0
              ? `${formatINR(receivables.overdueTotal)} overdue`
              : "Nothing overdue"
          }
        />
        <Kpi
          icon={Clock}
          label="Avg days to pay"
          value={cashFlow.avgDaysToPay !== null ? `${cashFlow.avgDaysToPay}d` : "—"}
          helper={
            cashFlow.medianDaysToPay !== null
              ? `Median ${cashFlow.medianDaysToPay}d`
              : "No paid invoices yet"
          }
        />
        <Kpi
          icon={Percent}
          label="Collection rate"
          value={
            invoices.collectionRatePct !== null
              ? `${Math.round(invoices.collectionRatePct)}%`
              : "—"
          }
          tone="success"
          helper={`${invoices.paidCount}/${invoices.issuedCount} invoices paid`}
        />
      </div>

      <DashboardRevenueChart series={revenue.series} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AgingCard receivables={receivables} />
        <FunnelCard funnel={funnel} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectRevenueCard byProject={insights.byProject} />
        <ProfitabilityCard p={insights.profitability} />
      </div>

      {analytics.gst.inUse ? <GstCard gst={analytics.gst} /> : null}

      {/* Top clients */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Top clients by paid revenue
            </p>
            <Link
              href="/dashboard/clients"
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              View all →
            </Link>
          </div>
          <ConcentrationStrip
            concentration={insights.concentration}
            clients={insights.clients}
          />
          {topClients.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No paid revenue yet"
              description="When paid invoices are created, clients will show up here ranked by revenue."
              className="min-h-[180px]"
            />
          ) : (
            <ul className="divide-y">
              {topClients.map((c) => (
                <li
                  key={c.clientId ?? c.name}
                  className="flex items-center justify-between gap-3 rounded-md px-1 py-2.5 transition-colors hover:bg-accent/50"
                >
                  {c.clientId ? (
                    <Link
                      href={`/dashboard/clients/${c.clientId}`}
                      className="flex min-w-0 flex-1 items-center gap-3"
                    >
                      <ClientCell name={c.name} initials={c.initials} count={c.invoiceCount} />
                    </Link>
                  ) : (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <ClientCell name={c.name} initials={c.initials} count={c.invoiceCount} />
                    </div>
                  )}
                  <span className="text-sm font-bold tabular-nums">
                    {formatINR(c.totalPaid)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

// --- Receivables aging ------------------------------------------------------

function AgingCard({
  receivables,
}: {
  receivables: PulseAnalytics["receivables"];
}) {
  const a = receivables.aging;
  const rows = [
    { label: "Current", value: a.current, tone: "bg-emerald-500" },
    { label: "1–30 days", value: a.d1_30, tone: "bg-amber-400" },
    { label: "31–60 days", value: a.d31_60, tone: "bg-orange-500" },
    { label: "61–90 days", value: a.d61_90, tone: "bg-red-500" },
    { label: "90+ days", value: a.d90plus, tone: "bg-red-700" },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hasAny = receivables.outstandingTotal > 0;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Receivables aging
          </p>
          {receivables.overdueCount > 0 ? (
            <Link
              href="/dashboard/invoices?status=overdue"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {receivables.overdueCount} overdue
            </Link>
          ) : null}
        </div>
        {!hasAny ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No outstanding invoices. You&rsquo;re all caught up. 🎉
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatINR(row.value)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", row.tone)}
                    style={{ width: `${Math.round((row.value / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Invoice funnel ---------------------------------------------------------

function FunnelCard({ funnel }: { funnel: PulseAnalytics["funnel"] }) {
  const steps = [
    { label: "Issued", value: funnel.issued, rate: null as number | null },
    { label: "Viewed", value: funnel.viewed, rate: funnel.viewedRatePct },
    { label: "Paid", value: funnel.paid, rate: funnel.paidRatePct },
  ];
  const max = Math.max(1, funnel.issued);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Invoice funnel (this range)
        </p>
        {funnel.issued === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No invoices issued in this range yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {s.value}
                    {s.rate !== null ? (
                      <span className="ml-1 text-[11px]">({Math.round(s.rate)}%)</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((s.value / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- GST summary ------------------------------------------------------------

function GstCard({ gst }: { gst: PulseAnalytics["gst"] }) {
  const t = gst.totals;
  const tiles = [
    { label: "Taxable value", value: t.taxable },
    { label: "CGST", value: t.cgst },
    { label: "SGST", value: t.sgst },
    { label: "IGST", value: t.igst },
    { label: "Total tax", value: t.tax },
  ];
  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-1 ring-primary/15">
              <Landmark className="h-4 w-4" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              GST summary (this range)
            </p>
          </div>
          {!gst.registered ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
              Not registered
            </span>
          ) : null}
        </div>

        {gst.totals.invoiceCount === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No GST invoices in this range.
            {gst.exempt.count > 0
              ? ` ${formatINR(gst.exempt.taxable)} in non-GST supplies across ${gst.exempt.count} invoice${gst.exempt.count === 1 ? "" : "s"}.`
              : ""}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {tiles.map((x) => (
                <div key={x.label} className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {x.label}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums">{formatINR(x.value)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <p>
                Intra-state (CGST+SGST):{" "}
                <span className="font-medium text-foreground">{formatINR(gst.intra.tax)}</span>{" "}
                on {formatINR(gst.intra.taxable)} ({gst.intra.count})
              </p>
              <p>
                Inter-state (IGST):{" "}
                <span className="font-medium text-foreground">{formatINR(gst.inter.tax)}</span>{" "}
                on {formatINR(gst.inter.taxable)} ({gst.inter.count})
              </p>
            </div>

            {/* By rate */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                By rate
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="py-1.5 text-left font-semibold">Rate</th>
                      <th className="py-1.5 text-right font-semibold">Taxable</th>
                      <th className="py-1.5 text-right font-semibold">CGST</th>
                      <th className="py-1.5 text-right font-semibold">SGST</th>
                      <th className="py-1.5 text-right font-semibold">IGST</th>
                      <th className="py-1.5 text-right font-semibold">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gst.byRate.map((r) => (
                      <tr key={r.rate}>
                        <td className="py-1.5 font-medium">{r.rate}%</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINR(r.taxable)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINR(r.cgst)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINR(r.sgst)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatINR(r.igst)}</td>
                        <td className="py-1.5 text-right font-semibold tabular-nums">{formatINR(r.tax)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* By client / state */}
            {gst.byClient.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  By client &amp; place of supply
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead>
                      <tr className="border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-1.5 text-left font-semibold">Client</th>
                        <th className="py-1.5 text-left font-semibold">State</th>
                        <th className="py-1.5 text-left font-semibold">Type</th>
                        <th className="py-1.5 text-right font-semibold">Taxable</th>
                        <th className="py-1.5 text-right font-semibold">Tax</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {gst.byClient.slice(0, 12).map((c) => (
                        <tr key={c.clientId ?? c.clientName}>
                          <td className="max-w-[160px] truncate py-1.5 font-medium">{c.clientName}</td>
                          <td className="py-1.5 text-muted-foreground">{c.stateCode ?? "—"}</td>
                          <td className="py-1.5">
                            <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              {c.b2b ? "B2B" : "B2C"}
                            </span>
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{formatINR(c.taxable)}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{formatINR(c.tax)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {gst.exempt.count > 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Plus {formatINR(gst.exempt.taxable)} in non-GST / exempt supplies across{" "}
                {gst.exempt.count} invoice{gst.exempt.count === 1 ? "" : "s"} (excluded from tax totals).
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Revenue by project -----------------------------------------------------

function ProjectRevenueCard({ byProject }: { byProject: PulseInsights["byProject"] }) {
  const rows = byProject.slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.paid));
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-1 ring-primary/15">
            <FolderKanban className="h-4 w-4" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Revenue by project
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No paid revenue in this range yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.projectId ?? row.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="tabular-nums text-muted-foreground">{formatINR(row.paid)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((row.paid / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// --- Time profitability -----------------------------------------------------

function ProfitabilityCard({ p }: { p: PulseInsights["profitability"] }) {
  const billablePct =
    p.trackedSeconds > 0 ? Math.round((p.billableSeconds / p.trackedSeconds) * 100) : 0;
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-1 ring-primary/15">
            <Timer className="h-4 w-4" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Time profitability
          </p>
        </div>
        {!p.hasTimeData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tracked time in this range. Log time to see profitability.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Mini label="Tracked" value={`${secondsToHours(p.trackedSeconds)}h`} />
              <Mini
                label="Billable"
                value={`${secondsToHours(p.billableSeconds)}h`}
                sub={`${billablePct}% of tracked`}
              />
              <Mini label="Effective rate" value={`${formatINR(p.effectiveRate)}/h`} />
              <Mini label="Unbilled value" value={formatINR(p.unbilledAmount)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Invoiced {formatINR(p.invoicedAmount)}</span>
                <span>Unbilled {formatINR(p.unbilledAmount)}</span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${
                      p.billableAmount > 0
                        ? Math.round((p.invoicedAmount / p.billableAmount) * 100)
                        : 0
                    }%`,
                  }}
                />
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${
                      p.billableAmount > 0
                        ? Math.round((p.unbilledAmount / p.billableAmount) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

// --- Concentration strip ----------------------------------------------------

function ConcentrationStrip({
  concentration,
  clients,
}: {
  concentration: PulseInsights["concentration"];
  clients: PulseInsights["clients"];
}) {
  if (concentration.totalPaid <= 0) return null;
  const top1 = concentration.top1Pct;
  const riskTone =
    top1 != null && top1 >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground";
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
      {top1 != null ? (
        <span className={riskTone}>
          Top client = <span className="font-semibold">{Math.round(top1)}%</span> of revenue
        </span>
      ) : null}
      {concentration.top3Pct != null ? (
        <span>
          Top 3 = <span className="font-semibold text-foreground">{Math.round(concentration.top3Pct)}%</span>
        </span>
      ) : null}
      <span>
        <span className="font-semibold text-foreground">{clients.newCount}</span> new ·{" "}
        <span className="font-semibold text-foreground">{clients.returningCount}</span> returning
      </span>
    </div>
  );
}

// --- Shared bits ------------------------------------------------------------

function ClientCell({
  name,
  initials,
  count,
}: {
  name: string;
  initials: string;
  count: number;
}) {
  return (
    <>
      <Avatar className="h-9 w-9 ring-1 ring-border">
        <AvatarFallback className="bg-gradient-to-br from-primary/10 to-indigo-500/10 text-[11px] font-bold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {count} paid invoice{count === 1 ? "" : "s"}
        </p>
      </div>
    </>
  );
}

type KpiTone = "default" | "primary" | "success" | "warning";

function Kpi({
  icon: Icon,
  label,
  value,
  helper,
  delta,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper?: string;
  delta?: number | null;
  tone?: KpiTone;
}) {
  const iconTone =
    tone === "success"
      ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 ring-emerald-500/15 dark:text-emerald-400"
      : tone === "warning"
        ? "bg-gradient-to-br from-amber-500/10 to-orange-500/10 text-amber-600 ring-amber-500/15 dark:text-amber-400"
        : "bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-primary/15";

  const TrendIcon =
    delta == null ? Minus : delta > 0.5 ? TrendingUp : delta < -0.5 ? TrendingDown : Minus;
  const trendClass =
    delta == null
      ? "text-muted-foreground"
      : delta > 0.5
        ? "text-emerald-600 dark:text-emerald-400"
        : delta < -0.5
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";

  return (
    <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.05]">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 break-words text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${iconTone}`}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {delta != null ? (
            <span className={`inline-flex items-center gap-0.5 text-[12px] font-semibold ${trendClass}`}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(delta)}%
            </span>
          ) : null}
        </div>
        {helper && <p className="text-[11px] text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  );
}
