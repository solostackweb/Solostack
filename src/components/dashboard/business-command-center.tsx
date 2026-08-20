"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  ReceiptText,
  Wallet,
} from "lucide-react";

import { formatINR, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RevenuePoint } from "@/features/pulse/server";
import { IvoEntryPoint } from "@/features/ai-workflows/components/ivo-entry-point";

export interface BusinessCommandCenterProps {
  collectedAllTime: number;
  outstanding: number;
  overdueAmount: number;
  activeProjects: number;
  weeklyBillableSeconds?: number;
  weeklyBillableAmount?: number;
  revenueSeries: RevenuePoint[];
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

function formatHours(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function BusinessCommandCenter({
  collectedAllTime,
  outstanding,
  overdueAmount,
  activeProjects,
  weeklyBillableSeconds = 0,
  weeklyBillableAmount = 0,
  revenueSeries,
}: BusinessCommandCenterProps) {
  const overdueShare =
    outstanding > 0 ? Math.min(100, (overdueAmount / outstanding) * 100) : 0;
  const collectedShare =
    collectedAllTime + outstanding > 0
      ? Math.round((collectedAllTime / (collectedAllTime + outstanding)) * 100)
      : 0;

  const currentMonth = revenueSeries.at(-1)?.paid ?? 0;
  const previousMonth = revenueSeries.at(-2)?.paid ?? 0;
  const monthlyDelta =
    previousMonth > 0
      ? ((currentMonth - previousMonth) / previousMonth) * 100
      : currentMonth > 0
        ? 100
        : 0;
  const bestMonth = Math.max(0, ...revenueSeries.map((point) => point.paid));

  const state =
    overdueAmount > 0
      ? {
          label: "Needs collection",
          Icon: AlertTriangle,
          className:
            "border-destructive/20 bg-destructive/[0.08] text-destructive dark:bg-destructive/[0.12]",
        }
      : outstanding > 0
        ? {
            label: "Follow up open invoices",
            Icon: ReceiptText,
            className:
              "border-warning-subtle bg-warning-subtle text-warning-strong",
          }
        : {
            label: "Cash position healthy",
            Icon: CheckCircle2,
            className:
              "border-success-subtle bg-success-subtle text-success-strong",
          };

  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm shadow-primary/[0.03]">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.38fr)]">
        <div className="border-b border-border/60 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Business command center
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {formatINR(collectedAllTime, { compact: true })}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cash collected from paid invoices
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                  state.className,
                )}
              >
                <state.Icon className="h-3.5 w-3.5" />
                {state.label}
              </span>
              <IvoEntryPoint
                variant="secondary"
                prompt="What should I focus on today?"
                label="Ask Ivo"
              />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-muted-foreground">
                  Collection ratio
                </span>
                <span className="font-mono font-semibold tabular-nums">
                  {collectedShare}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(0, Math.min(100, collectedShare))}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                icon={ReceiptText}
                label="Outstanding"
                value={formatINR(outstanding, { compact: true })}
                note="Issued but unpaid"
                tone={outstanding > 0 ? "warning" : "muted"}
              />
              <Metric
                icon={AlertTriangle}
                label="Overdue"
                value={formatINR(overdueAmount, { compact: true })}
                note={
                  outstanding > 0
                    ? `${overdueShare.toFixed(0)}% of receivables`
                    : "Nothing past due"
                }
                tone={overdueAmount > 0 ? "danger" : "muted"}
              />
              <Metric
                icon={FolderKanban}
                label="Active work"
                value={String(activeProjects)}
                note={activeProjects === 1 ? "Project in flight" : "Projects in flight"}
                tone="default"
              />
              <Metric
                icon={Clock}
                label="This week"
                value={weeklyBillableSeconds > 0 ? formatHours(weeklyBillableSeconds) : "0h"}
                note={
                  weeklyBillableAmount > 0
                    ? `${formatINR(weeklyBillableAmount, { compact: true })} billable`
                    : "No billable time yet"
                }
                tone="default"
              />
            </div>

          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Revenue trend</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Paid invoice revenue over the last {revenueSeries.length} months
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full border bg-background px-2.5 py-1 text-xs">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="font-mono font-semibold tabular-nums">
                {formatINR(currentMonth, { compact: true })}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-semibold",
                  monthlyDelta >= 0 ? "text-success" : "text-destructive",
                )}
              >
                <ArrowUpRight
                  className={cn("h-3 w-3", monthlyDelta < 0 && "rotate-90")}
                />
                {formatPercent(monthlyDelta)}
              </span>
            </div>
          </div>

          {bestMonth > 0 ? (
            <div className="h-[260px] w-full sm:h-[310px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueSeries}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashboard-paid-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="70%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthLabel}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      formatINR(value as number, { compact: true })
                    }
                    width={52}
                  />
                  <Tooltip
                    cursor={{
                      stroke: "hsl(var(--primary) / 0.25)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const paid = payload[0]?.value as number | undefined;
                      return (
                        <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-xl">
                          <p className="font-semibold text-popover-foreground">
                            {formatMonthLabel(label as string)}
                          </p>
                          <p className="mt-1 tabular-nums text-muted-foreground">
                            Paid{" "}
                            <span className="font-mono font-bold text-foreground">
                              {formatINR(paid ?? 0)}
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="paid"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#dashboard-paid-fill)"
                    activeDot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/15 text-center sm:h-[310px]">
              <Wallet className="h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-semibold">No paid revenue yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Paid invoices will turn this into a monthly revenue trend.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface MetricProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  note: string;
  tone: "default" | "warning" | "danger" | "muted";
}

function Metric({ icon: Icon, label, value, note, tone }: MetricProps) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-tight">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
            tone === "default" && "bg-primary/10 text-primary ring-primary/15",
            tone === "warning" &&
              "bg-warning-subtle text-warning-strong ring-warning-subtle",
            tone === "danger" && "bg-destructive/10 text-destructive ring-destructive/20",
            tone === "muted" && "bg-muted text-muted-foreground ring-border",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
