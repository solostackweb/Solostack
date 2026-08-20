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
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RevenuePoint } from "@/features/pulse/server";
import { formatINR, formatPercent } from "@/lib/format";

interface RevenueChartProps {
  series: RevenuePoint[];
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

export function RevenueChart({ series }: RevenueChartProps) {
  const totalPaid = series.reduce((a, p) => a + p.paid, 0);

  const delta = React.useMemo(() => {
    if (series.length < 2) return null;
    const prev = series[series.length - 2]!.paid;
    const curr = series[series.length - 1]!.paid;
    if (prev === 0) return curr > 0 ? { value: 100, trend: "up" as const } : null;
    const pct = ((curr - prev) / prev) * 100;
    return {
      value: pct,
      trend:
        pct > 0.5 ? ("up" as const) : pct < -0.5 ? ("down" as const) : ("flat" as const),
    };
  }, [series]);

  const TrendIcon =
    delta?.trend === "up"
      ? TrendingUp
      : delta?.trend === "down"
        ? TrendingDown
        : Minus;
  const trendClass =
    delta?.trend === "up"
      ? "text-success"
      : delta?.trend === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className="border-border/60 shadow-sm shadow-primary/[0.03]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-semibold tracking-tight">Revenue overview</CardTitle>
          <CardDescription className="text-xs">
            Paid invoice revenue over the last {series.length} months
          </CardDescription>
          <div className="flex items-baseline gap-2 pt-2">
            <span className="font-mono text-2xl font-bold tabular-nums tracking-tight">
              {formatINR(totalPaid, { compact: true })}
            </span>
            {delta && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trendClass}`}
              >
                <TrendIcon className="h-3.5 w-3.5" />
                {formatPercent(delta.value)}
              </span>
            )}
          </div>
        </div>
        <Legend />
      </CardHeader>
      <CardContent className="pl-2">
        {totalPaid > 0 ? (
          <div className="h-[200px] w-full sm:h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={series}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="paid-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(243 75% 58%)" stopOpacity={0.35} />
                    <stop offset="60%" stopColor="hsl(262 83% 62%)" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="hsl(262 83% 62%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="paid-stroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="hsl(243 75% 58%)" />
                    <stop offset="100%" stopColor="hsl(262 83% 62%)" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  opacity={0.4}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonthLabel}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatINR(v as number, { compact: true })}
                  width={48}
                />
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--primary) / 0.25)",
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const paid = payload.find((p) => p.dataKey === "paid")?.value as
                      | number
                      | undefined;
                    return (
                      <div className="rounded-lg border border-border/60 bg-popover px-3.5 py-2.5 text-xs shadow-xl shadow-primary/10">
                        <p className="font-semibold text-popover-foreground">
                          {formatMonthLabel(label as string)}
                        </p>
                        <p className="mt-1.5 tabular-nums text-muted-foreground">
                          Paid:{" "}
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
                  stroke="url(#paid-stroke)"
                  strokeWidth={2.5}
                  fill="url(#paid-fill)"
                  activeDot={{ r: 4, fill: "hsl(243 75% 58%)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center sm:h-[260px]">
            <p className="text-sm font-medium">No revenue yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Create paid invoices to see your revenue trend here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" /> Paid
      </span>
    </div>
  );
}
